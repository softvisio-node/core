import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import GoogleCloudMessagingApi from "#lib/api/google/cloud/messaging";
import Counter from "#lib/threads/counter";
import LocaleTranslation from "#lib/locale/translation";
import User from "#lib/app/user";

const CLEAR_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours

const PUSH_NOTIFICATION_GROUPS = new Set( ["all", "guests", "users", "root"] );

const SQL = {
    "insertInternalNotification": sql`INSERT INTO notification_internal ( subject, body, expires ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),

    "setChannelActive": {
        "internal": sql`INSERT INTO user_notification_profile ( user_id, notification, internal ) VALUES ( ?, ?, ? ) ON CONFLICT ( user_id, notification ) DO UPDATE SET internal = EXCLUDED.internal`.prepare(),

        "email": sql`INSERT INTO user_notification_profile ( user_id, notification, email ) VALUES ( ?, ?, ? ) ON CONFLICT ( user_id, notification ) DO UPDATE SET email = EXCLUDED.email`.prepare(),

        "telegram": sql`INSERT INTO user_notification_profile ( user_id, notification, telegram ) VALUES ( ?, ?, ? ) ON CONFLICT ( user_id, notification ) DO UPDATE SET telegram = EXCLUDED.telegram`.prepare(),

        "push": sql`INSERT INTO user_notification_profile ( user_id, notification, push ) VALUES ( ?, ?, ? ) ON CONFLICT ( user_id, notification ) DO UPDATE SET push = EXCLUDED.push`.prepare(),
    },

    "setUserNotificationActive": sql`INSERT INTO user_notification_profile ( user_id, notification, internal, email, telegram, push ) VALUES ( ?, ?, ?, ?, ?, ? ) ON CONFLICT ( user_id, notification ) DO UPDATE SET internal = EXCLUDED.internal, email = EXCLUDED.email, telegram = EXCLUDED.telegram, push = EXCLUDED.push`.prepare(),
};

export default class {
    #app;
    #config;
    #smtp;
    #telegramBotId;
    #types;
    #channels = {
        "internal": {
            "supported": true,
            "enabled": false,
        },
        "email": {
            "supported": false,
            "enabled": false,
        },
        "telegram": {
            "supported": false,
            "enabled": false,
        },
        "push": {
            "supported": false,
            "enabled": false,
        },
    };
    #hasEnabledChannels = false;
    #pushNotificationsPrefix;
    #googleCloudMessagingApi;
    #activityCounter = new Counter();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get emailSupported () {
        return this.#channels.email.supported;
    }

    get emailNotificationsEnabled () {
        return this.#channels.email.enabled;
    }

    get telegramSupported () {
        return this.#channels.telegram.supported;
    }

    get telegramNotificationsEnabled () {
        return this.#channels.telegram.enabled;
    }

    get telegramBotUsername () {
        return this.#telegramBot?.telegramUsername;
    }

    get pushNotificationsSupported () {
        return this.#channels.push.supported;
    }

    get pushNotificationsEnabled () {
        return this.#channels.push.enabled;
    }

    get pushNotificationsPrefix () {
        return this.#pushNotificationsPrefix;
    }

    // public
    async configure () {

        // internal notifications
        this.#channels.internal.enabled = this.config.channels.internal;

        // email notifications
        if ( this.config.smtp ) {
            this.#channels.email.supported = true;
            this.#channels.email.enabled = this.config.channels.email;

            this.#smtp = new Smtp( this.config.smtp );
        }
        else {
            this.#channels.email.supported = false;
            this.#channels.email.enabled = false;
        }

        // telegram notifications
        if ( this.config.telegramBot.apiKey ) {
            this.#channels.telegram.supported = true;
            this.#channels.telegram.enabled = this.config.channels.telegram;
        }
        else {
            this.#channels.telegram.supported = false;
            this.#channels.telegram.enabled = false;
        }

        // push notifications
        if ( this.config.firebase?.serviceAccount ) {
            this.#channels.push.supported = true;
            this.#channels.push.enabled = this.config.channels.push;

            this.#pushNotificationsPrefix = this.config.firebase.prefix ? this.config.firebase.prefix + "." : "";
            this.#googleCloudMessagingApi = new GoogleCloudMessagingApi( this.config.firebase.serviceAccount );
        }
        else {
            this.#channels.push.supported = false;
            this.#channels.push.enabled = false;

            this.#pushNotificationsPrefix = "";
        }

        this.#types = this.config.types || {};

        // set notificatio channels defaults
        for ( const type of Object.values( this.#types ) ) {
            const channels = ( type.channels ??= {} );

            for ( const channel of Object.keys( this.#channels ) ) {
                channels[channel] ??= {};

                if ( this.#channels[channel].enabled ) {
                    channels[channel].enabled ??= true;
                }
                else {
                    channels[channel].enabled = false;
                }

                if ( channels[channel].enabled ) {
                    channels[channel].editable ??= true;
                    channels[channel].default ??= true;

                    this.#hasEnabledChannels = true;
                }
                else {
                    channels[channel].editable = false;
                    channels[channel].default = false;
                }
            }
        }

        return result( 200 );
    }

    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async start () {
        if ( this.#channels.internal.enabled ) {
            setInterval( this.#clear.bind( this ), CLEAR_INTERVAL );
        }

        // create telegram bot
        if ( this.config.telegramBot.apiKey && this.app.telegram ) {
            const res = await this.app.telegram.createStaticBot( this.config.telegramBot );

            if ( !res.ok ) return res;

            this.#telegramBotId = res.data.id;
        }

        return result( 200 );
    }

    async shutDown () {
        return this.#activityCounter.wait();
    }

    isChannelSupported ( channel ) {
        return this.#channels[channel]?.supported;
    }

    isChannelEnabled ( channel ) {
        return this.#channels[channel]?.enabled;
    }

    async registerPushNotificationsToken ( token, userId ) {
        if ( !this.pushNotificationsSupported ) return result( [503, `Push notifications are not supported`] );

        var finalRes = result( 200 );

        const counter = new Counter();

        const then = res => {
            if ( !res.ok ) finalRes = res;

            counter.value--;
        };

        // prefix.all
        counter.value++;
        this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}all`, token ).then( then );

        if ( userId ) {

            // users
            counter.value++;
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}users`, token ).then( then );

            // root
            if ( this.app.userIsRoot( userId ) ) {
                counter.value++;
                this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}root`, token ).then( then );
            }

            // prefix.users.<user_id>
            counter.value++;
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}users.${userId}`, token ).then( then );
        }
        else {

            // guests
            counter.value++;
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}guests`, token ).then( then );
        }

        await counter.wait();

        return finalRes;
    }

    async sendNotification ( type, users, subject, body, options = {} ) {
        if ( !this.#hasEnabledChannels ) return;

        // invalid notification type
        if ( !this.#types[type] ) throw `Notification type "${type}" is invalid`;

        const internalUsers = [],
            emailUsers = [],
            telegramUsers = [],
            pushUsers = [];

        if ( !Array.isArray( users ) ) users = [users];

        for ( const userId of users ) {
            const user = await this.app.users.getUserById( userId );

            // user not found or disabled
            if ( !user?.isEnabled ) continue;

            const defaultChannels = this.#types[type].channels,
                userChannels = user.notifications?.[type];

            // internal
            if ( defaultChannels.internal.enabled && ( defaultChannels.internal.editable ? userChannels?.internal ?? defaultChannels.internal.default : defaultChannels.internal.default ) ) {
                internalUsers.push( user );
            }

            // email
            if ( defaultChannels.email.enabled && ( defaultChannels.email.editable ? userChannels?.email ?? defaultChannels.email.default : defaultChannels.email.default ) ) {
                emailUsers.push( user );
            }

            // telegram
            if ( defaultChannels.telegram.enabled && ( defaultChannels.telegram.editable ? userChannels?.telegram ?? defaultChannels.telegram.default : defaultChannels.telegram.default ) ) {
                telegramUsers.push( user.id );
            }

            // push
            if ( defaultChannels.push.enabled && ( defaultChannels.push.editable ? userChannels?.push ?? defaultChannels.push.default : defaultChannels.push.default ) ) {
                pushUsers.push( user );
            }
        }

        const promises = [];

        // internal
        if ( internalUsers.length ) {
            promises.push( this.sendInternalNotification( internalUsers, subject, body, options.internal ) );
        }

        // email
        if ( emailUsers.length ) {
            promises.push( this.sendEmailNotification( emailUsers, subject, body, options.email ) );
        }

        // telegram
        if ( telegramUsers.length ) {
            promises.push( this.#sendTelegram( telegramUsers, subject, body, options.telegram ) );
        }

        // push
        if ( pushUsers.length ) {
            promises.push( this.sendPushNotification( pushUsers, subject, body, options.push ) );
        }

        return Promise.all( promises );
    }

    async sendInternalNotification ( users, subject, body, { maxAge } = {} ) {

        // service not available
        if ( !this.#channels.internal.enabled ) return result( 503 );

        if ( maxAge === undefined ) maxAge = this.config.internalNotificationsMaxAge;

        if ( maxAge ) {
            var expires = new Date( Date.now() + maxAge * 1000 );
        }

        const locales = {},
            userId = [];

        for ( let user of users ) {
            if ( !( user instanceof User ) ) {
                user = await this.app.users.getUserById( user );

                // user not found or disabled
                if ( !user?.isEnabled ) continue;
            }

            userId.push( user.id );

            locales[user.locale] ??= {
                "users": [],
                "subject": LocaleTranslation.translate( subject, { "domain": user.locale } ),
                "body": LocaleTranslation.translate( body, { "domain": user.locale } ),
            };

            locales[user.locale].users.push( user.id );
        }

        this.#activityCounter.value++;

        const res = await this.dbh.begin( async dbh => {
            for ( const locale of Object.values( locales ) ) {
                let res;

                res = await dbh.selectRow( SQL.insertInternalNotification, [locale.subject, locale.body, expires] );

                if ( !res.ok ) throw res;

                const notificationId = res.data.id;

                res = await dbh.do( sql`INSERT INTO notification_internal_user`.VALUES( locale.users.map( userId => {
                    return {
                        "user_id": userId,
                        "notification_internal_id": notificationId,
                    };
                } ) ) );

                if ( !res.ok ) throw res;
            }

            // send global api event
            this.app.publishToApi( "/notifications/update/", userId, { "inbox": true, "done": false } );
        } );

        this.#activityCounter.value--;

        return res;
    }

    async sendEmailNotification ( users, subject, body, options = {} ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        if ( !Array.isArray( users ) ) users = [users];

        const counter = new Counter();

        this.#activityCounter.value++;

        for ( const userId of users ) {
            const user = userId instanceof User ? userId : await this.app.users.getUserById( userId );

            // user not found or disabled
            if ( !user?.isEnabled ) continue;

            counter.value++;

            this.sendEmail(

                //
                user.email,
                LocaleTranslation.translate( subject, { "domain": user.locale } ),
                LocaleTranslation.translate( body, { "domain": user.locale } ),
                options
            ).then( res => counter.value-- );
        }

        await counter.wait();

        this.#activityCounter.value--;

        return result( 200 );
    }

    // target: all, guests, users, root, <userId>
    async sendPushNotification ( targets, subject, body, options = {} ) {
        if ( !this.pushNotificationsSupported ) return result( 503 );

        if ( !Array.isArray( targets ) ) targets = [targets];

        const message = { ...options };

        if ( subject || body ) {
            message.notification ||= {};
        }

        message.webpush ??= {};
        message.webpush.notification ??= {};
        message.webpush.notification.icon ??= "/favicon.ico";

        message.webpush.fcmOptions ??= {};
        message.webpush.fcmOptions.link ??= "/";

        const counter = new Counter();

        this.#activityCounter.value++;

        for ( const target of targets ) {
            counter.value++;

            // to group
            if ( PUSH_NOTIFICATION_GROUPS.has( target ) ) {
                this.#googleCloudMessagingApi
                    .send( {
                        ...message,
                        "topic": this.#pushNotificationsPrefix + target,
                        "notification": {
                            "title": subject,
                            body,
                            ...message.notification,
                        },
                    } )
                    .then( res => counter.value-- );
            }

            // to user
            else {
                const user = target instanceof User ? target : await this.app.users.getUserById( target );

                // user not found or disabled
                if ( !user?.isEnabled ) continue;

                this.#googleCloudMessagingApi
                    .send( {
                        ...message,
                        "topic": this.#pushNotificationsPrefix + "users." + user.id,
                        "notification": {
                            "title": LocaleTranslation.translate( subject, { "domain": user.locale } ),
                            "body": LocaleTranslation.translate( body, { "domain": user.locale } ),
                            ...message.notification,
                        },
                    } )
                    .then( res => counter.value-- );
            }
        }

        await counter.wait();

        this.#activityCounter.value--;

        return result( 200 );
    }

    async sendEmail ( to, subject, body, options = {} ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        this.#activityCounter.value++;

        const res = await this.#smtp.sendEmail( {
            ...options,
            to,
            subject,
            "textBody": body,
        } );

        this.#activityCounter.value--;

        return res;
    }

    async getUserNotificationsProfile ( userId ) {
        if ( !this.#hasEnabledChannels ) return result( 200 );

        const user = await this.app.users.getUserById( userId );

        // user not found or disabled
        if ( !user?.isEnabled ) return result( 200 );

        const notifications = [];

        for ( const notification in this.#types ) {
            const defaultChannels = this.#types[notification].channels,
                userChannels = user.notifications?.[notification];

            const notificationProfile = {
                "id": notification,
                "name": this.#types[notification].name,
                "description": this.#types[notification].description,
                "channels": {},
            };

            notifications.push( notificationProfile );

            for ( const channel of Object.keys( this.#channels ) ) {
                notificationProfile.channels[channel] = {
                    "enabled": defaultChannels[channel].enabled,
                    "editable": defaultChannels[channel].editable,
                    "active": defaultChannels[channel].editable ? userChannels?.[channel] ?? defaultChannels[channel].default : defaultChannels[channel].default,
                };
            }
        }

        return result( 200, notifications );
    }

    async setUserNotificationChannelActive ( userId, notification, channel, active ) {
        const defaultChannel = this.#types[notification]?.channels[channel];

        if ( !defaultChannel?.editable ) return result( [400, `Unable to update notification channel`] );

        return this.dbh.do( SQL.setChannelActive[channel], [userId, notification, active] );
    }

    async setUserNotificationActive ( userId, notification, active ) {
        if ( !this.#types[notification] ) return result( [404, `Notification is not valid`] );

        return this.dbh.do( SQL.setUserNotificationActive, [

            //
            userId,
            notification,
            active,
            active,
            active,
            active,
        ] );
    }

    async getLinkedTelegramUsername ( userId ) {
        if ( !this.telegramSupported ) return null;

        const user = await this.#telegramBot.users.getByApiUserId( userId );

        if ( user ) {
            return user.username;
        }
        else {
            return null;
        }
    }

    async unlinkTelegram ( userId ) {
        if ( !this.telegramSupported ) {
            return result( [500, `Telegram is not supported`] );
        }

        const user = await this.#telegramBot.users.getByApiUserId( userId );

        if ( !user ) return result( 200 );

        return user.setApiUserId();
    }

    // private
    get #telegramBot () {
        return this.app.telegram.getBot( this.#telegramBotId );
    }

    async #sendTelegram ( users, subject, body, options ) {
        if ( !this.telegramSupported ) return;

        this.#activityCounter.value++;

        for ( const userId of users ) {
            const user = await this.#telegramBot.users.getByApiUserId( userId );

            if ( !user ) continue;

            const msg = LocaleTranslation.translate( subject, { "domain": user.locale } ) + "\n\n" + LocaleTranslation.translate( body, { "domain": user.locale } );

            await user.sendMessage( msg );
        }

        this.#activityCounter.value--;
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
        notification_internal_user
    USING
        notification_internal
    WHERE
        notification_internal_user.notification_internal_id = notification_internal.id
        AND notification_internal.expires <= CURRENT_TIMESTAMP
    RETURNING
        notification_internal_user.user_id,
        notification_internal_user.done
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

                this.app.publishToApi( "/notifications/update/" + userId, row );
            }
        }

        if ( mutex ) await mutex.up();
    }
}
