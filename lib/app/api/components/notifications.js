import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import GoogleCloudMessagingApi from "#lib/api/google/cloud/messaging";

const CLEAR_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours

const CHANNELS = ["internal", "email", "telegram", "push"];

const SQL = {
    "insertInternalNotification": sql`INSERT INTO api_internal_notification ( subject, body, expires ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),

    "upsertUserNotificationTypeChannel": sql`INSERT INTO user_notifications_profile ( user_id, type, channel, enabled ) VALUES ( ?, ?, ?, ? ) ON CONFLICT ( user_id, type, channel ) DO UPDATE SET enabled = EXCLUDED.enabled`.prepare(),
};

export default class extends Component {
    #smtp;
    #telegramBot;
    #types;
    #hasEnabledNotifications;
    #internalNotificationsEnabled;
    #emailNotificationsEnabled;
    #telegramNotificationsEnabled;
    #pushNotificationsEnabled = false;
    #pushNotificationsPrefix;
    #googleCloudMessagingApi;

    // properties
    get internalNotificationsEnabled () {
        return this.#internalNotificationsEnabled;
    }

    get emailSupported () {
        return !!this.#smtp;
    }

    get emailNotificationsEnabled () {
        return this.#emailNotificationsEnabled;
    }

    get telegramSupported () {
        return !!this.#telegramBot;
    }

    get telegramNotificationsEnabled () {
        return this.#telegramNotificationsEnabled;
    }

    get telegramBotUsername () {
        return this.#telegramBot?.telegramUsername;
    }

    get pushNotificationsSupported () {
        return !!this.#googleCloudMessagingApi;
    }

    get pushNotificationsEnabled () {
        return this.#pushNotificationsEnabled;
    }

    get pushNotificationsPrefix () {
        return this.#pushNotificationsPrefix;
    }

    // public
    async registerPushNotificationsToken ( token, userId ) {
        if ( !this.pushNotificationsSupported ) return result( [503, `Push notifications are not supported`] );

        var res;

        res = await this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}all`, token );
        if ( !res.ok ) return res;

        if ( userId ) {
            res = await this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}users`, token );
            if ( !res.ok ) return res;

            res = await this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}user.${userId}`, token );
            if ( !res.ok ) return res;
        }
        else {
            res = await this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}guests`, token );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async sendNotification ( type, users, subject, body, options = {} ) {
        if ( !this.#hasEnabledNotifications ) return;

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
            if ( defaultChannels.internal.enabled && ( userChannels?.internal ?? defaultChannels.internal.default ) ) {
                internalUsers.push( user.id );
            }

            // email
            if ( defaultChannels.emai.enabled && ( userChannels?.emai ?? defaultChannels.emai.default ) ) {
                this.#sendEmail( user.email, subject, body, options.email );
            }

            // telegram
            if ( defaultChannels.telegram.enabled && ( userChannels?.telegram ?? defaultChannels.telegram.default ) ) {
                this.#sendTelegram( user.telegramUserId, subject, body, options.telegram );
            }

            // push
            if ( defaultChannels.push.enabled && ( userChannels?.push ?? defaultChannels.push.default ) ) {
                this.sendPushNotification( "user." + user.id, subject, body, options.push );
            }
        }

        if ( internalUsers.length ) this.sendInternalNotification( internalUsers, subject, body, options.internal );
    }

    async sendInternalNotification ( users, subject, body, { maxAge } = {} ) {

        // service not available
        if ( !this.internalNotificationsEnabled ) return result( 503 );

        if ( !Array.isArray( users ) ) users = [users];

        const res = await this.dbh.begin( async dbh => {
            var res, expires;

            if ( maxAge ) {
                expires = new Date( Date.now() + maxAge * 1000 );
            }

            res = await dbh.selectRow( SQL.insertInternalNotification, [subject, body, expires] );

            if ( !res.ok ) throw res;

            const notificationId = res.data.id;

            res = await dbh.do( sql`INSERT INTO user_internal_notification`.VALUES( users.map( userId => {
                return {
                    "user_id": userId,
                    "api_internal_notification_id": notificationId,
                };
            } ) ) );

            if ( !res.ok ) throw res;

            // send global api event
            this.app.publish( "/api/notifications/update/", users, { "inbox": true, "done": false } );
        } );

        return res;
    }

    async sendEmailNotification ( users, subject, body, options ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        if ( !Array.isArray( users ) ) users = [users];

        for ( const userId of users ) {
            const user = await this.api.cache.getUserById( userId );

            // user not found or disabled
            if ( !user?.isEnabled ) continue;

            this.#sendEmail( user.email, subject, body, options );
        }
    }

    // topics: all, guests, users, user.<userId>
    async sendPushNotification ( topic, subject, body, options = {} ) {
        if ( !this.pushNotificationsSupported ) return result( 503 );

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

        return this.#googleCloudMessagingApi.send( message );
    }

    async sendEmail ( to, subject, body, options ) {
        return this.#sendEmail( to, subject, body, options );
    }

    // XXX
    async getUserNotificationsProfile ( userId ) {
        const profile = {
            "internalNotificationsEnabled": this.internalNotificationsEnabled,
            "emailNotificationsEnabled": this.emailNotificationsEnabled,
            "telegramNotificationsEnabled": this.telegramNotificationsEnabled,
            "pushNotificationsEnabled": this.pushNotificationsEnabled,
        };

        if ( !this.#hasEnabledNotifications ) return profile;

        const user = await this.api.cache.getUserById( userId );

        // user not found or disabled
        if ( !user?.isEnabled ) return profile;

        const types = [];

        profile.types = types;

        for ( const type in this.#types ) {
            const defaultChannels = this.#types[type].channels,
                userChannels = user.notifications?.[type];

            const typeProfile = {
                type,
                "name": this.#types[type].name,
                "description": this.#types[type].description,
            };

            types.push( typeProfile );

            // internal
            if ( this.internalNotificationsEnabled ) {
                if ( defaultChannels.internal == null ) {
                    typeProfile.internal = null;
                }
                else {
                    typeProfile.internal = userChannels?.internal ?? defaultChannels.internal;
                }
            }

            // email
            if ( this.emailNotificationsEnabled ) {
                if ( defaultChannels.email == null ) {
                    typeProfile.email = null;
                }
                else {
                    typeProfile.email = userChannels?.email ?? defaultChannels.email;
                }
            }

            // telegram
            if ( this.telegramNotificationsEnabled ) {
                if ( defaultChannels.telegram == null ) {
                    typeProfile.telegram = null;
                }
                else {
                    typeProfile.telegram = userChannels?.telegram ?? defaultChannels.telegram;
                }
            }

            // push
            if ( this.pushNotificationsEnabled ) {
                if ( defaultChannels.push == null ) {
                    typeProfile.push = null;
                }
                else {
                    typeProfile.push = userChannels?.push ?? defaultChannels.push;
                }
            }
        }

        return profile;
    }

    async setUserNotificationChannelEnabled ( userId, type, channel, enabled ) {
        if ( !this.#types[type] ) return result( [400, `Notification type is invalid`] );

        if ( !( channel in this.#types[type].channels ) ) return result( [400, `Notification channel is invalid`] );

        return this.dbh.do( SQL.upsertUserNotificationTypeChannel, [userId, type, channel, enabled] );
    }

    // protected
    async _init () {

        // validate notifications config
        this.#types = this.api.config.notifications.types || {};

        // internal notifications
        this.#internalNotificationsEnabled = this.api.config.notifications.internalNotificationsEnabled;

        // email notifications
        if ( this.api.config.notifications.smtp ) {
            this.#emailNotificationsEnabled = this.api.config.notifications.emailNotificationsEnabled;
            this.#smtp = new Smtp( this.api.config.notifications.smtp );
        }
        else {
            this.#emailNotificationsEnabled = false;
        }

        // telegram notifications
        if ( this.api.config.notifications.telegramBot.apiKey ) {
            this.#telegramNotificationsEnabled = this.api.config.notifications.telegramNotificationsEnabled;
        }
        else {
            this.#telegramNotificationsEnabled = false;
        }

        // push notifications
        if ( this.api.config.notifications.firebase?.serviceAccount ) {
            this.#pushNotificationsEnabled = this.api.config.notifications.pushNotificationsEnabled;
            this.#pushNotificationsPrefix = this.api.config.notifications.firebase.prefix ? this.api.config.notifications.firebase.prefix + "." : "";
            this.#googleCloudMessagingApi = new GoogleCloudMessagingApi( this.api.config.notifications.firebase.serviceAccount );
        }
        else {
            this.#pushNotificationsEnabled = false;
            this.#pushNotificationsPrefix = "";
        }

        const enabledChannels = {};

        for ( const type of Object.values( this.#types ) ) {
            const channels = type.channels;

            for ( const channel of CHANNELS ) {
                if ( channels[channel] == null ) {
                    channels[channel] = {
                        "enabled": false,
                        "default": false,
                    };
                }
                else {
                    channels[channel] = {
                        "enabled": this[channel + "NotificationsEnabled"],
                        "default": channels[channel],
                    };

                    if ( channels[channel].enabled ) enabledChannels[channel] = true;
                }
            }
        }

        if ( !enabledChannels.internal ) this.#internalNotificationsEnabled = false;
        if ( !enabledChannels.email ) this.#emailNotificationsEnabled = false;
        if ( !enabledChannels.telegram ) this.#telegramNotificationsEnabled = false;
        if ( !enabledChannels.push ) this.#pushNotificationsEnabled = false;

        this.#hasEnabledNotifications = this.#internalNotificationsEnabled || this.#emailNotificationsEnabled || this.#telegramNotificationsEnabled || this.#pushNotificationsEnabled;

        return result( 200 );
    }

    async _run () {
        if ( this.internalNotificationsEnabled ) {
            setInterval( this.#clear.bind( this ), CLEAR_INTERVAL );
        }

        // create telegram bot
        if ( this.api.config.notifications.telegramBot.apiKey ) {
            const res = await this.app.telegram.createStaticBot( this.api.config.notifications.telegramBot );

            if ( !res.ok ) return res;

            this.#telegramBot = await this.app.telegram.getBot( res.data.id );
        }

        return result( 200 );
    }

    // XXX wait for push, telegram, internal...
    async _shutDown () {
        if ( this.#smtp ) await this.#smtp.shutDown();
    }

    // private
    #sendEmail ( to, subject, text, options = {} ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        return this.#smtp.sendEmail( {
            ...options,
            to,
            subject,
            text,
        } );
    }

    // XXX
    async #sendTelegram ( chatId, subject, body, options ) {
        const res = await this.#telegramBot.sendMessage( chatId, subject + "\n\n" + body );

        if ( res.status === 403 ) {

            // XXX bot banned
        }

        return res;
    }

    async #clear () {
        var mutex;

        if ( this.app.cluster ) {
            mutex = this.app.cluster.mutexes.get( "api/notifications/clear" );

            if ( !( await mutex.tryLock() ) ) return;
        }

        const res = await this.dbh.selectRow( sql`
WITH deleted AS (
    DELETE FROM
        user_internal_notification
    USING
        api_internal_notification
    WHERE
        user_internal_notification.api_internal_notification_id = api_internal_notification.id
        AND api_internal_notification.expires <= CURRENT_TIMESTAMP
    RETURNING
        user_internal_notification.user_id,
        user_internal_notification.done
)
SELECT
    user_id,
    count( nullif( done, TRUE ) )::int4::bool AS inbox,
    count( nullif( done, FALSE ) )::int4::bool AS done
FROM
    deleted
GROUP BY
    user_id
` );

        if ( res.data ) {
            for ( const row of res.data ) {
                const userId = row.user_id;
                delete row.user_id;

                this.app.publish( "/api/notifications/update/" + userId, row );
            }
        }

        if ( mutex ) await mutex.up();
    }
}
