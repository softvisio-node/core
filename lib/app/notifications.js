import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import TelegramBot from "#lib/api/telegram/bot";
import CacheLru from "#lib/cache-lru";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "insert": sql`INSERT INTO internal_notification ( subject, body, meta, expires ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "clear": sql`DELETE FROM internal_notification WHERE expires <= CURRENT_TIMESTAMP`.prepare(),
    "updateTelegramChatId": sql`INSERT INTO user_telegram ( user_id, chat_id ) VALUES ( ?, ? ) ON CONFLICT ( user_id ) DO UPDATE SET chat_id = ?`.prepare(),
    "getProfileByUserId": sql`
SELECT
    "user".id AS user_id,
    "user".email AS user_email,
    "user".telegram_username,
    user_notification_type.internal,
    user_notification_type.email,
    user_notification_type.telegram,
    user_notification_type.push,
    user_telegram.chat_id
FROM
    "user"
    LEFT JOIN user_notification_type ON ( "user".id = user_notification_type.user_id )
    LEFT JOIN user_telegram ON ( "user".id = user_telegram.user_id )
WHERE
    "user".id = ?
    AND "user".enabled = TRUE
`.prepare(),
    "getProfileByTelegramUsername": sql`
SELECT
    "user".id AS user_id,
    "user".email AS user_email,
    "user".telegram_username,
    user_notification_type.internal,
    user_notification_type.email,
    user_notification_type.telegram,
    user_notification_type.push,

    user_telegram.chat_id
FROM
    "user"
    LEFT JOIN user_notification_type ON ( "user".id = user_notification_type.user_id )
    LEFT JOIN user_telegram ON ( "user".id = user_telegram.user_id )
WHERE
    "user".telegram_username = ?
    AND "user".enabled = TRUE
`.prepare(),
};

const CHANNELS = new Set( ["internal", "email", "telegram", "push"] );

export default class Notifications {
    #app;
    #smtp;
    #telegram;
    #notifications;
    #mutexSet = new Mutex.Set();
    #started;

    #userIdCache;
    #telegramUsernameCache = {};

    #emailEnabled;
    #telegramEnabled;
    #pushEnabled;

    // XXX init push
    constructor ( app ) {
        this.#app = app;

        this.#userIdCache = new CacheLru( {
            "maxSize": 10000,
        } ).on( "delete", ( userId, profile ) => {
            if ( profile.telegramUsername ) this.#telegramUsernameCache.delete( profile.telegramUsername );
        } );

        // validate notifications config
        this.#notifications = this.#app.settings?.notifications || {};

        for ( const type in this.#notifications ) {
            for ( const channel in this.#notifications[type].channels ) {
                if ( !CHANNELS.has( channel ) ) throw `Notification channel "${channel}" for type "${type}" is invalid`;

                if ( typeof this.#notifications[type][channel] !== "boolean" && this.#notifications[type][channel] !== null ) `Notification channel "${channel}" value for type "${type}" must be boolean or null`;
            }
        }

        // init email
        if ( process.env.APP_SMTP_HOSTNAME && +process.env.APP_SMTP_PORT && process.env.APP_SMTP_USERNAME && process.env.APP_SMTP_PASSWORD ) {
            this.#emailEnabled = true;
        }
        else {
            this.#emailEnabled = false;
        }

        // init telegram
        if ( process.env.APP_TELEGRAM_BOT_KEY ) {
            this.#telegramEnabled = true;

            this.#telegram = new TelegramBot( process.env.APP_TELEGRAM_BOT_KEY );
        }
        else {
            this.#telegramEnabled = false;
        }

        // init push
        this.#pushEnabled = false;

        // set dbh events listeners
        this.dbh.on( "disconnect", () => this.#userIdCache.reset() );

        this.dbh.on( "event/api/user-telegram-chat/update", data => {
            const profile = this.#userIdCache.get( data.user_id );

            if ( profile ) profile.telegramChatId = data.chat_id;
        } );

        this.dbh.on( "api/user-email/update", data => {
            const profile = this.#userIdCache.get( data.user_id );

            if ( profile ) profile.email = data.email;
        } );

        this.dbh.on( "api/user-telegram-username/update", data => {
            const profile = this.#userIdCache.get( data.user_id );

            if ( profile ) profile.telegramUsername = data.telegram_username;
        } );

        this.dbh.on( "api/user-enabled/update", data => this.#invalidateCache( data.user_id ) );
        this.dbh.on( "api/user/delete", data => this.#invalidateCache( data.user_id ) );
        this.dbh.on( "api/user-notification-type/update", data => this.#invalidateCache( data.user_id ) );
    }

    // properties
    get dbh () {
        return this.#app.dbh;
    }

    get emailEnabled () {
        return this.#emailEnabled;
    }

    get telegramEnabled () {
        return this.#telegramEnabled;
    }

    get pushEnabled () {
        return this.#pushEnabled;
    }

    // public
    run () {
        if ( this.#started ) return;

        this.#started = true;

        // cleanup internal user notifications
        setInterval( () => this.dbh.do( QUERIES.clear ), 1000 * 60 * 60 * 24 );

        // start telegram polling
        if ( this.telegramEnabled ) {
            this.#telegram.on( "message", this.#onTelegramMessage.bind( this ) );

            this.#telegram.startPolling();
        }

        return result( 200 );
    }

    async getTelegramBotUsername () {
        if ( !this.#telegram ) return;

        const res = await this.#telegram.getProfile();

        return res.data?.username;
    }

    async sendNotification ( type, users, subject, body, options ) {
        if ( !this.#notifications[type] ) throw `Notification type "${type}" is invalid`;

        const internalUsers = [];

        for ( const userId of users ) {
            const profile = await this.getUserNotificationsProfileByUserId( userId );

            // user not found or disabled
            if ( !profile ) continue;

            const channels = profile.notifications[type];

            if ( channels.internal ) internalUsers.push( profile.userId );

            if ( channels.email && profile.email ) this.#sendEmail( profile.email, subject, body, options );

            if ( channels.telegram && profile.telegramChatId ) this.#sendTelegram( profile.telegramChatId, subject, body, options );

            if ( channels.push && profile.pushChannelId ) this.#sendPush( profile.pushChannelId, subject, body, options );
        }

        if ( internalUsers.length ) this.sendInternalNotification( internalUsers, subject, body, options );
    }

    async sendInternalNotification ( users, subject, body, options = {} ) {
        const res = await this.dbh.begin( async dbh => {
            var res, expires;

            if ( options.maxAge ) {
                expires = new Date();
                expires.setTime( expires.getTime() + options.maxAge );
            }

            res = await dbh.selectRow( QUERIES.insert, [subject, body, options.meta, expires] );

            if ( !res.ok ) throw res;

            const notificationId = res.data.id;

            res = await dbh.do( sql`INSERT INTO user_internal_notification`.VALUES( users.map( userId => {
                return {
                    "user_id": userId,
                    "notification_id": notificationId,
                };
            } ) ) );

            if ( !res.ok ) throw res;

            this.#app.publish( "/api", users, "notifications" );
        } );

        return res;
    }

    async sendEmailNotification ( users, subject, body, options ) {
        for ( const userId of users ) {
            const profile = await this.getUserNotificationsProfileByUserId( userId );

            // user not found or disabled
            if ( !profile || !profile.email ) continue;

            this.#sendEmail( profile.email, subject, body, options );
        }
    }

    async sendEmail ( to, subject, body, options ) {
        return this.#sendEmail( to, subject, body, options );
    }

    async getUserNotificationsProfileByUserId ( userId ) {
        var profile = this.#userIdCache.get( userId + "" );

        if ( profile ) return profile;

        const res = await this.dbh.select( QUERIES.getProfileByUserId, [userId] );

        // profile not found or user disabled
        if ( !res.data ) return;

        profile = this.#buildProfile( res.data );

        this.#userIdCache.set( userId + "", profile );
        if ( profile.telegramUsername ) this.#telegramUsernameCache[profile.telegramUsername] = profile;

        return profile;
    }

    // private
    async #getUserNotificationsProfileByTelegramUsername ( telegramUsername ) {
        var profile = this.#telegramUsernameCache[telegramUsername];

        if ( profile ) return profile;

        const res = await this.dbh.select( QUERIES.getProfileByTelegramUsername, [telegramUsername] );

        // profile not found or user disabled
        if ( !res.data ) return;

        profile = this.#buildProfile( res.data );

        this.#userIdCache.set( profile.userId + "", profile );
        if ( profile.telegramUsername ) this.#telegramUsernameCache[profile.telegramUsername] = profile;

        return profile;
    }

    #buildProfile ( data ) {
        const profile = {
            "userId": data[0].user_id,
            "email": data[0].user_email,
            "telegramUsername": data[0].telegram_username,
            "telegramChatId": data[0].chat_id,
            "pushChannelId": null,
            "notifications": {},
        };

        const idx = {};
        for ( const row of data ) idx[row.type] = row;

        for ( const type in this.#notifications ) {
            const defaultChannels = this.#notifications[type].channels,
                channels = idx[type];

            profile.notifications[type] = {
                "internal": defaultChannels.internal == null ? null : channels?.internal ?? defaultChannels.internal ?? false,
                "email": !this.emailEnabled || defaultChannels.email == null ? null : channels?.email ?? defaultChannels.email ?? false,
                "telegram": !this.telegramEnabled || defaultChannels.telegram == null ? null : channels?.telegram ?? defaultChannels.telegram ?? false,
                "push": !this.pushEnabled || defaultChannels.push == null ? null : channels?.push ?? defaultChannels.push ?? false,
            };
        }

        return profile;
    }

    #invalidateCache ( userId ) {
        this.#userIdCache.delete( userId + "" );
    }

    async #onTelegramMessage ( data ) {
        if ( data.message ) {
            const chatId = data.message.chat.id,
                telegramUsername = data.message.chat.username;

            const mutex = this.#mutexSet.get( telegramUsername );

            if ( !mutex.tryDown() ) return;

            const profile = await this.#getUserNotificationsProfileByTelegramUsername( telegramUsername );

            // not authorized
            if ( !profile ) {
                await this.#telegram.sendMessage( chatId, `You are not authorized to use this bot.` );
            }
            else {

                // u[date user chat id
                if ( profile.telegramChatId !== chatId ) {
                    await this.dbh.do( QUERIES.updateTelegramChatId, [profile.userId, chatId, chatId] );
                }

                this.#telegram.sendMessage( chatId, `You are subscribed to the notifications. This bot doesn't support any additional commands.` );
            }

            this.#mutexSet.delete( mutex );
        }
    }

    #sendEmail ( to, subject, body, options = {} ) {
        if ( !this.#smtp ) {
            this.#smtp = new Smtp( {
                "hostname": process.env.APP_SMTP_HOSTNAME,
                "port": +process.env.APP_SMTP_PORT,
                "username": process.env.APP_SMTP_USERNAME,
                "password": process.env.APP_SMTP_PASSWORD,
            } );
        }

        if ( !options.from && process.env.APP_SMTP_FROM ) options = { ...options, "from": process.env.APP_SMTP_FROM };

        return this.#smtp.sendEmail( to, subject, body, options );
    }

    // XXX remove chat on send failure
    async #sendTelegram ( chatId, subject, body, options ) {
        const res = await this.#telegram.sendMessage( chatId, subject + "\n" + body );

        if ( res.status === 403 ) {

            // XXX bot banned
        }

        return res;
    }

    // XXX
    #sendPush ( channelId, subject, body, options ) {}
}
