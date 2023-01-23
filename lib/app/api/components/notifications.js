import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import TelegramBot from "#lib/api/telegram/bot";
import Firebase from "#lib/api/firebase";

const QUERIES = {
    "insertInternalNotification": sql`INSERT INTO internal_notification ( subject, body, meta, expires ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),

    "clearInternalNotifications": sql`DELETE FROM internal_notification WHERE expires <= CURRENT_TIMESTAMP`.prepare(),

    "insertTelegramUser": sql`INSERT INTO telegram_user ( id, name ) VALUES ( ?, ? )`.prepare(),

    "deleteTelegramUser": sql`DELETE FROM telegram_user WHERE id = ?`.prepare(),

    "upsertUserNotificationTypeChannel": sql`INSERT INTO user_notifications_profile ( user_id, type, channel, enabled ) VALUES ( ?, ?, ?, ? ) ON CONFLICT ( user_id, type, channel ) DO UPDATE SET enabled = EXCLUDED.enabled`.prepare(),
};

export default class extends Component {
    #smtp;
    #telegram;
    #types;
    #started;

    #telegramBotUsername;

    #emailEnabled;
    #telegramEnabled;
    #pushNotificationsEnabled;
    #pushNotificationsPrefix;
    #firebase;

    // properties
    get emailEnabled () {
        return this.#emailEnabled;
    }

    get telegramEnabled () {
        return this.#telegramEnabled;
    }

    get pushNotificationsEnabled () {
        return this.#pushNotificationsEnabled;
    }

    get pushNotificationsPrefix () {
        return this.#pushNotificationsPrefix;
    }

    // public
    async getTelegramBotUsername () {
        if ( !this.#telegram ) return;

        if ( !this.#telegramBotUsername ) {
            const res = await this.#telegram.send( "getMe" );

            this.#telegramBotUsername = res.data?.username;
        }

        return this.#telegramBotUsername;
    }

    async registerPushNotificationsToken ( token, userId ) {
        if ( !this.pushNotificationsEnabled ) return result( [500, `Push notifications are not supported`] );

        var res;

        res = await this.#firebase.messaging.subscribeToTopic( `${this.#pushNotificationsPrefix}devices.all`, token );
        if ( !res.ok ) return res;

        if ( userId ) {
            res = await this.#firebase.messaging.subscribeToTopic( `${this.#pushNotificationsPrefix}users.all`, token );
            if ( !res.ok ) return res;

            res = await this.#firebase.messaging.subscribeToTopic( `${this.#pushNotificationsPrefix}users.${userId}`, token );
            if ( !res.ok ) return res;
        }
        else {
            res = await this.#firebase.messaging.subscribeToTopic( `${this.#pushNotificationsPrefix}guests.all`, token );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async sendNotification ( type, users, subject, body, options = {} ) {

        // invalid notification type
        if ( !this.#types[type] ) throw `Notification type "${type}" is invalid`;

        const internalUsers = [];

        if ( !Array.isArray( users ) ) users = [users];

        for ( const userId of users ) {
            const user = await this.api.cache.getUserById( userId );

            // user not found or disabled
            if ( !user?.isEnabled ) continue;

            const defaultChannels = this.#types[type].channels,
                userChannels = user.notifications?.[type];

            // internal
            if ( defaultChannels.internal != null ) {
                if ( userChannels?.internal ?? defaultChannels.internal ) {
                    internalUsers.push( user.id );
                }
            }

            // email
            if ( this.emailEnabled && defaultChannels.email != null ) {
                if ( userChannels?.email ?? defaultChannels.email ) {
                    this.#sendEmail( user.email, subject, body, options.email );
                }
            }

            // telegram
            if ( this.telegramEnabled && defaultChannels.telegram != null && user.telegramUserId ) {
                if ( userChannels?.telegram ?? defaultChannels.telegram ) {
                    this.#sendTelegram( user.telegramUserId, subject, body, options.telegram );
                }
            }

            // push
            if ( this.pushNotificationsEnabled && defaultChannels.push != null ) {
                if ( userChannels?.push ?? defaultChannels.puah ) {
                    this.sendPushNotification( "users." + user.id, subject, body, options.push );
                }
            }
        }

        if ( internalUsers.length ) this.sendInternalNotification( internalUsers, subject, body, options.internal );
    }

    async sendInternalNotification ( users, subject, body, options = {} ) {
        if ( !Array.isArray( users ) ) users = [users];

        const res = await this.dbh.begin( async dbh => {
            var res, expires;

            if ( options.maxAge ) {
                expires = new Date();
                expires.setTime( expires.getTime() + options.maxAge );
            }

            res = await dbh.selectRow( QUERIES.insertInternalNotification, [subject, body, options.meta, expires] );

            if ( !res.ok ) throw res;

            const notificationId = res.data.id;

            res = await dbh.do( sql`INSERT INTO user_internal_notification`.VALUES( users.map( userId => {
                return {
                    "user_id": userId,
                    "notification_id": notificationId,
                };
            } ) ) );

            if ( !res.ok ) throw res;

            // send global api event
            this.app.publish( "/api/notifications/", users );
        } );

        return res;
    }

    async sendEmailNotification ( users, subject, body, options ) {
        if ( !Array.isArray( users ) ) users = [users];

        for ( const userId of users ) {
            const profile = await this.getUserNotificationsProfileByUserId( userId );

            // user not found or disabled
            if ( !profile || !profile.email ) continue;

            this.#sendEmail( profile.email, subject, body, options );
        }
    }

    // topics: all-devices, all-guests, all-users, user-<userId>
    async sendPushNotification ( topic, subject, body, options = {} ) {
        if ( !this.pushNotificationsEnabled ) return result( 500 );

        const message = {
            ...options,
            "topic": this.#pushNotificationsPrefix + topic,
        };

        if ( subject || body ) {
            message.notification ||= {};

            if ( subject ) message.notification.title ||= subject;

            if ( body ) message.notification.body ||= body;
        }

        message.webpush ??= {};
        message.webpush.notification ??= {};
        message.webpush.notification.icon ??= "/favicon.ico";

        message.webpush.fcmOptions ??= {};
        message.webpush.fcmOptions.link ??= "/";

        return this.#firebase.messaging.send( message );
    }

    async sendEmail ( to, subject, body, options ) {
        return this.#sendEmail( to, subject, body, options );
    }

    async getUserNotificationsProfile ( userId ) {
        const user = await this.api.cache.getUserById( userId );

        // user not found or disabled
        if ( !user?.isEnabled ) return;

        const types = [];

        for ( const type in this.#types ) {
            const defaultChannels = this.#types[type].channels,
                userChannels = user.notifications?.[type];

            const profile = {
                type,
                "name": this.#types[type].name,
                "description": this.#types[type].description,

                // internal: defaultChannels.internal != null && userChannels?.internal ?? defaultChannels.internal,
            };

            types.push( profile );

            // internal
            if ( defaultChannels.internal == null ) {
                profile.internal = null;
            }
            else {
                profile.internal = userChannels?.internal ?? defaultChannels.internal;
            }

            // email
            if ( !this.emailEnabled || defaultChannels.email == null ) {
                profile.email = null;
            }
            else {
                profile.email = userChannels?.email ?? defaultChannels.email;
            }

            // telegram
            if ( !this.telegramEnabled || defaultChannels.telegram == null ) {
                profile.telegram = null;
            }
            else {
                profile.telegram = userChannels?.telegram ?? defaultChannels.telegram;
            }

            // push
            if ( !this.pushNotificationsEnabled || defaultChannels.push == null ) {
                profile.push = null;
            }
            else {
                profile.push = userChannels?.push ?? defaultChannels.puah;
            }
        }

        return types;
    }

    async setUserNotificationChannelEnabled ( userId, type, channel, enabled ) {
        if ( !this.#types[type] ) return result( [400, `Notification type is invalid`] );

        if ( !( channel in this.#types[type].channels ) ) return result( [400, `Notification channel is invalid`] );

        return this.dbh.do( QUERIES.upsertUserNotificationTypeChannel, [userId, type, channel, enabled] );
    }

    // protected
    async _init () {

        // validate notifications config
        this.#types = this.api.config.notifications.types || {};

        // init email
        if ( this.api.config.notifications.smtp ) {
            this.#emailEnabled = true;
        }
        else {
            this.#emailEnabled = false;
        }

        // init telegram
        if ( this.api.config.notifications.telegramBotKey ) {
            this.#telegramEnabled = true;

            this.#telegram = new TelegramBot( this.api.config.notifications.telegramBotKey );
        }
        else {
            this.#telegramEnabled = false;
        }

        // init push
        if ( this.api.config.notifications.firebase?.serviceAccount ) {
            this.#pushNotificationsEnabled = true;

            this.#pushNotificationsPrefix = this.api.config.notifications.firebase.prefix ? this.api.config.notifications.firebase.prefix + "." : "";

            this.#firebase = await Firebase.new( this.api.config.notifications.firebase.serviceAccount );
        }
        else {
            this.#pushNotificationsEnabled = false;

            this.#pushNotificationsPrefix = "";
        }

        return result( 200 );
    }

    _run () {
        if ( this.#started ) result( 200 );

        this.#started = true;

        // cleanup internal user notifications
        setInterval( () => this.dbh.do( QUERIES.clearInternalNotifications ), 1000 * 60 * 60 * 24 );

        // start telegram polling
        if ( this.telegramEnabled ) {
            this.#telegram.on( "update", this.#onTelegramUpdate.bind( this ) );

            this.#telegram.start();
        }

        return result( 200 );
    }

    // private
    async #onTelegramUpdate ( update ) {
        const telegramUserId = update.from?.id,
            telegramUsername = update.from?.username;

        if ( !telegramUserId ) return;

        // chat_member message
        if ( update.type === "my_chat_member" ) {

            // bot blocked
            if ( update.new_chat_member.status === "kicked" ) {
                await this.dbh.do( QUERIES.deleteTelegramUser, [telegramUserId] );
            }

            // bot restarted
            else if ( update.new_chat_member.status === "member" ) {
                await this.dbh.do( QUERIES.insertTelegramUser, [telegramUserId, telegramUsername] );

                this.#telegram.sendMessage( telegramUserId, `You are subscribed to the notifications. This bot doesn't support any additional commands.` );
            }
        }
        else {
            const user = await this.api.cache.getUserByTelegramUserId( telegramUserId );

            if ( !user ) {
                await this.#telegram.sendMessage( telegramUserId, `You are not authorized to use this bot. Please set your telegram username at the project notification settings and type "/start" again.` );
            }
            else {
                this.#telegram.sendMessage( telegramUserId, `This is notifications bot. It doesn't support any additional commands.` );
            }
        }
    }

    #sendEmail ( to, subject, text, options = {} ) {
        if ( !this.#smtp ) {
            this.#smtp = new Smtp( this.api.config.notifications.smtp );
        }

        return this.#smtp.sendEmail( {
            ...options,
            to,
            subject,
            text,
        } );
    }

    async #sendTelegram ( chatId, subject, body, options ) {
        const res = await this.#telegram.sendMessage( chatId, subject + "\n\n" + body );

        if ( res.status === 403 ) {

            // XXX bot banned
        }

        return res;
    }
}
