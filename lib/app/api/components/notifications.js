import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import GoogleCloudMessagingApi from "#lib/api/google/cloud/messaging";
import Counter from "#lib/threads/counter";

const CLEAR_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours

const PUSH_NOTIFICATION_GROUPS = new Set( ["all", "guests", "users"] );

const SQL = {
    "insertInternalNotification": sql`INSERT INTO api_internal_notification ( subject, body, expires ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),

    "upsertUserNotificationTypeChannel": sql`INSERT INTO user_notifications_profile ( user_id, type, channel, enabled ) VALUES ( ?, ?, ?, ? ) ON CONFLICT ( user_id, type, channel ) DO UPDATE SET enabled = EXCLUDED.enabled`.prepare(),
};

export default class extends Component {
    #smtp;
    #telegramBotId;
    #types;
    #channels = {
        "internal": false,
        "email": false,
        "telegram": false,
        "push": false,
    };
    #hasEnabledChannels = false;
    #pushNotificationsPrefix;
    #googleCloudMessagingApi;

    // properties
    get internalNotificationsEnabled () {
        return this.#channels.internal;
    }

    get emailSupported () {
        return !!this.#smtp;
    }

    get emailNotificationsEnabled () {
        return this.#channels.email;
    }

    get telegramSupported () {
        return !!this.#telegramBotId;
    }

    get telegramNotificationsEnabled () {
        return this.#channels.telegram;
    }

    get telegramBotUsername () {
        return this.#telegramBot?.telegramUsername;
    }

    get pushNotificationsSupported () {
        return !!this.#googleCloudMessagingApi;
    }

    get pushNotificationsEnabled () {
        return this.#channels.push;
    }

    get pushNotificationsPrefix () {
        return this.#pushNotificationsPrefix;
    }

    // public
    async registerPushNotificationsToken ( token, userId ) {
        if ( !this.pushNotificationsSupported ) return result( [503, `Push notifications are not supported`] );

        var finalRes = result( 200 );

        const counter = new Counter().inc();

        const then = res => {
            if ( !res.ok ) finalRes = res;

            counter.dec();
        };

        // prefix.all
        counter.inc();
        this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}all`, token ).then( then );

        if ( userId ) {

            // prefix.users
            counter.inc();
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}users`, token ).then( then );

            // prefix.users.<user_id>
            counter.inc();
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}users.${userId}`, token ).then( then );
        }
        else {

            // prefix.guests
            counter.inc();
            this.#googleCloudMessagingApi.subscribeToTopic( `${this.#pushNotificationsPrefix}guests`, token ).then( then );
        }

        await counter.dec().wait();

        return finalRes;
    }

    async sendNotification ( type, users, subject, body, options = {} ) {
        if ( !this.#hasEnabledChannels ) return;

        // invalid notification type
        if ( !this.#types[type] ) throw `Notification type "${type}" is invalid`;

        const internalUsers = [],
            emails = [],
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
            if ( defaultChannels.internal.enabled && ( userChannels?.internal ?? defaultChannels.internal.default ) ) {
                internalUsers.push( user.id );
            }

            // email
            if ( defaultChannels.email.enabled && ( userChannels?.email ?? defaultChannels.email.default ) ) {
                emails.push( user.email );
            }

            // telegram
            if ( defaultChannels.telegram.enabled && ( userChannels?.telegram ?? defaultChannels.telegram.default ) ) {
                telegramUsers.push( user.id );
            }

            // push
            if ( defaultChannels.push.enabled && ( userChannels?.push ?? defaultChannels.push.default ) ) {
                pushUsers.push( user.id );
            }
        }

        const promises = [];

        if ( internalUsers.length ) promises.push( this.sendInternalNotification( internalUsers, subject, body, options.internal ) );

        if ( emails.length ) {
            for ( const email of emails ) {
                promises.push( this.sendEmail( email, subject, body, options.email ) );
            }
        }

        if ( telegramUsers.length ) promises.push( this.#sendTelegram( telegramUsers, subject, body, options.telegram ) );

        if ( pushUsers.length ) promises.push( this.sendPushNotification( pushUsers, subject, body, options.push ) );

        return Promise.all( promises );
    }

    async sendInternalNotification ( users, subject, body, { maxAge } = {} ) {
        if ( maxAge === undefined ) maxAge = this.api.config.notifications.internalNotificationsMaxAge;

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

            res = await dbh.do( sql`INSERT INTO api_user_internal_notification`.VALUES( users.map( userId => {
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

    async sendEmailNotification ( users, subject, body, options = {} ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        if ( !Array.isArray( users ) ) users = [users];

        for ( const userId of users ) {
            const user = await this.app.users.getUserById( userId );

            // user not found or disabled
            if ( !user?.isEnabled ) continue;

            this.sendEmail( user.email, subject, body, options );
        }
    }

    // target: all, guests, users, users.<userId>
    async sendPushNotification ( targets, subject, body, options = {} ) {
        if ( !this.pushNotificationsSupported ) return result( 503 );

        if ( !Array.isArray( targets ) ) targets = [targets];

        const message = { ...options };

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

        const counter = new Counter().inc();

        for ( const target of targets ) {
            counter.inc();

            this.#googleCloudMessagingApi
                .send( {
                    ...message,
                    "topic": PUSH_NOTIFICATION_GROUPS.has( target ) ? this.#pushNotificationsPrefix + target : this.#pushNotificationsPrefix + "users." + target,
                } )
                .then( res => counter.dec() );
        }

        await counter.dec().wait();

        return result( 200 );
    }

    async sendEmail ( to, subject, body, options = {} ) {

        // service not available
        if ( !this.emailSupported ) return result( 503 );

        return this.#smtp.sendEmail( {
            ...options,
            to,
            subject,
            "textBody": body,
        } );
    }

    async getUserNotificationsProfile ( userId ) {
        const profile = {
            "internalNotificationsEnabled": this.internalNotificationsEnabled,
            "emailNotificationsEnabled": this.emailNotificationsEnabled,
            "telegramNotificationsEnabled": this.telegramNotificationsEnabled,
            "pushNotificationsEnabled": this.pushNotificationsEnabled,
            "telegramSupported": this.telegramSupported,
        };

        if ( this.telegramSupported ) {
            profile.telegramUrl = "tg://resolve?domain=" + this.telegramBotUsername;
            profile.telegramLinked = await this.isTelegramLinked( userId );
        }

        if ( !this.#hasEnabledChannels ) return profile;

        const user = await this.app.users.getUserById( userId );

        // user not found or disabled
        if ( !user?.isEnabled ) return profile;

        const types = [];

        profile.types = types;

        for ( const type in this.#types ) {
            const defaultChannels = this.#types[type].channels,
                userChannels = user.notifications?.[type];

            const typeProfile = {
                "id": type,
                "name": this.#types[type].name,
                "description": this.#types[type].description,
                "channels": {},
            };

            types.push( typeProfile );

            for ( const channel of Object.keys( this.#channels ) ) {
                typeProfile.channels[channel] = {
                    "supported": defaultChannels[channel].enabled,
                    "editable": defaultChannels[channel].editable,
                    "enabled": defaultChannels[channel].enabled ? userChannels?.[channel] ?? defaultChannels[channel].default : null,
                };
            }
        }

        return profile;
    }

    async setUserNotificationChannelEnabled ( userId, type, channel, enabled ) {
        const defaultChannel = this.#types[type]?.channels[channel];

        if ( !defaultChannel?.editable ) return result( [400, `Unable to update notification channel`] );

        return this.dbh.do( SQL.upsertUserNotificationTypeChannel, [userId, type, channel, enabled] );
    }

    async isTelegramLinked ( userId ) {
        if ( !this.telegramSupported ) {
            return false;
        }

        return this.#telegramBot.isUserLinked( userId );
    }

    async unlinkTelegram ( userId ) {
        if ( !this.telegramSupported ) {
            return result( [500, `Telegram is not supported`] );
        }

        return this.#telegramBot.unlinkUser( userId );
    }

    // protected
    async _init () {

        // validate notifications config
        this.#types = this.api.config.notifications.types || {};

        // internal notifications
        this.#channels.internal = this.api.config.notifications.internalNotificationsEnabled;

        // email notifications
        if ( this.api.config.notifications.smtp ) {
            this.#channels.email = this.api.config.notifications.emailNotificationsEnabled;
            this.#smtp = new Smtp( this.api.config.notifications.smtp );
        }
        else {
            this.#channels.email = false;
        }

        // telegram notifications
        if ( this.api.config.notifications.telegramBot.apiKey ) {
            this.#channels.telegram = this.api.config.notifications.telegramNotificationsEnabled;
        }
        else {
            this.#channels.telegram = false;
        }

        // push notifications
        if ( this.api.config.notifications.firebase?.serviceAccount ) {
            this.#channels.push = this.api.config.notifications.pushNotificationsEnabled;
            this.#pushNotificationsPrefix = this.api.config.notifications.firebase.prefix ? this.api.config.notifications.firebase.prefix + "." : "";
            this.#googleCloudMessagingApi = new GoogleCloudMessagingApi( this.api.config.notifications.firebase.serviceAccount );
        }
        else {
            this.#channels.push = false;
            this.#pushNotificationsPrefix = "";
        }

        const enabledChannels = {};

        for ( const type of Object.values( this.#types ) ) {
            const channels = type.channels;

            for ( const channel of Object.keys( this.#channels ) ) {
                channels[channel] ??= {};

                channels[channel].enabled ??= this.#channels[channel];
                channels[channel].editable = channels[channel].enabled ? channels[channel].editable ?? true : false;
                channels[channel].default = channels[channel].enabled ? channels[channel].default ?? true : null;

                if ( channels[channel].enabled ) enabledChannels[channel] = true;
            }
        }

        for ( const channel of Object.keys( this.#channels ) ) {
            if ( !enabledChannels[channel] ) this.#channels[channel] = false;

            if ( this.#channels[channel] ) this.#hasEnabledChannels = true;
        }

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

            this.#telegramBotId = res.data.id;
        }

        return result( 200 );
    }

    // XXX wait for push, telegram, internal...
    async _shutDown () {
        if ( this.#smtp ) await this.#smtp.shutDown();
    }

    // private
    get #telegramBot () {
        return this.app.telegram.getBot( this.#telegramBotId );
    }

    async #sendTelegram ( users, subject, body ) {
        if ( !this.telegramSupported ) return;

        return this.#telegramBot.sendNotification( users, subject, body );
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
        api_user_internal_notification
    USING
        api_internal_notification
    WHERE
        api_user_internal_notification.api_internal_notification_id = api_internal_notification.id
        AND api_internal_notification.expires <= CURRENT_TIMESTAMP
    RETURNING
        api_user_internal_notification.user_id,
        api_user_internal_notification.done
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
