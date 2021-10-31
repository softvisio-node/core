import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import TelegramBot from "#lib/api/telegram/bot";
import CacheLru from "#lib/cache-lru";
import Mutex from "#lib/threads/mutex";

const QUERIES = {
    "insert": sql`INSERT INTO internal_notification ( subject, body, meta, expires ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "clear": sql`DELETE FROM internal_notification WHERE expires <= CURRENT_TIMESTAMP`.prepare(),
    "getProfile": sql`
SELECT
    "user".email,
    "user".telegram_username,
    user_notification_type.*,
    user_telegram.chat_id
FROM
    "user"
    LEFT JOIN user_notification_type ON ( "user".id = user_notification_type.user_id )
    LEFT JOIN user_telegram ON ( "user".id = user_telegram.user_id )
WHERE
    "user".id = ?
    AND "user".enabled = TRUE
`.prepare(),
};

const CHANNELS = new Set( ["internal", "email", "telegram", "push"] );

export default class Notifications {
    #app;
    #smtp;
    #telegram;
    #cache;
    #notifications;
    #mutexSet = new Mutex.Set();

    #emailEnabled;
    #telegramEnabled;
    #pushEnabled;

    // XXX set cache invalidation listeners
    // XXX init push
    constructor ( app ) {
        this.#app = app;
        this.#cache = new CacheLru( { "maxSize": 10000 } );

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

        setInterval( () => this.dbh.do( QUERIES.clear ), 1000 * 60 * 60 * 24 );
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
        if ( this.telegramEnabled ) {
            this.#telegram.on( "message", this.#onTelegramMessage.bind( this ) );

            this.#telegram.startPolling();
        }

        return result( 200 );
    }

    async sendNotification ( type, users, subject, body, options ) {
        if ( !this.#notifications[type] ) throw `Notification type "${type}" is invalid`;

        const internalUsers = [];

        for ( const userId of users ) {
            const profile = await this.#getUserNotificationsProfile( userId );

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
            const profile = await this.#getUserNotificationsProfile( userId );

            // user not found or disabled
            if ( !profile || !profile.email ) continue;

            this.#sendEmail( profile.email, subject, body, options );
        }
    }

    async sendEmail ( to, subject, body, options ) {
        return this.#sendEmail( to, subject, body, options );
    }

    // private
    // XXX interate ove default types
    async #getUserNotificationsProfile ( userId ) {
        var profile = this.#cache.get( userId );

        if ( profile ) return profile;

        const res = await this.dbh.select( QUERIES.getProfile, [userId] );

        if ( !res.data ) return;

        profile = {
            "userId": res.data[0].user_id,
            "email": res.data[0].email,
            "telegramUsername": res.data[0].telegram_username,
            "telegramChatId": res.data[0].char_id,
            "pushChannelId": null,
            "notifications": {},
        };

        for ( const row of res.data ) {
            if ( !this.#notifications[row.type] ) continue;

            const defaultChannels = this.#notifications[row.type].channels;

            profile.notifications[row.type] = {
                "intenal": defaultChannels.internal == null ? null : row.internal ?? defaultChannels.internal ?? false,
                "email": !this.emailEnabled || defaultChannels.email == null ? null : row.email ?? defaultChannels.email ?? false,
                "telegram": !this.telegramEnabled || defaultChannels.telegram == null ? null : row.telegram ?? defaultChannels.telegram ?? false,
                "push": !this.pushEnabled || defaultChannels.push == null ? null : row.push ?? defaultChannels.push ?? false,
            };
        }

        this.#cache.set( userId, profile );

        return profile;
    }

    // XXX update chat_id
    async #onTelegramMessage ( data ) {
        const chatId = data.message.chat.id,
            telegramUsername = data.message.chat.username;

        const mutex = this.#mutexSet.get( telegramUsername );

        if ( !mutex.tryDown() ) return;

        var profile = await this.#getUserNotificationsProfile( telegramUsername );

        // not authorized
        if ( !profile ) {
            await this.#telegram.sendMessage( chatId, `You are not authorized to use this bot.` );
        }
        else {
            console.log( telegramUsername );

            // this.dbh.do( sql`INSERT INTO user_telegram SET chat_id = ? FROM "user" WHERE "user".id = user_telegram.user_id AND "user".telegram_username = ? ON CONFLICT ( user_id ) DO UPDATE SET chat_id = ?`, [chatId, telegramUsername, chatId] );

            this.#telegram.sendMessage( chatId, `This bot doesn't support any commands. To stop receiving notifications just delete this chat.` );
        }

        this.#mutexSet.delete( mutex );
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

    // XXX remove chat if on send failure
    #sendTelegram ( chatId, subject, body, options ) {
        return this.#telegram.sendMessage( chatId, subject + "\n" + body );
    }

    // XXX
    #sendPush ( channelId, subject, body, options ) {}
}
