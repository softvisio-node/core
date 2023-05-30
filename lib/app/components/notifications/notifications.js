import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import GoogleCloudMessagingApi from "#lib/api/google/cloud/messaging";
import Counter from "#lib/threads/counter";
import LocaleTemplate from "#lib/locale/template";

const CLEAR_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours

const PUSH_NOTIFICATION_GROUPS = new Set( ["all", "guests", "users"] );

const SQL = {
    "insertInternalNotification": sql`INSERT INTO notification_internal ( subject, body, expires ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),

    "upsertUserNotificationTypeChannel": sql`INSERT INTO notification_user_profile ( user_id, type, channel, enabled ) VALUES ( ?, ?, ?, ? ) ON CONFLICT ( user_id, type, channel ) DO UPDATE SET enabled = EXCLUDED.enabled`.prepare(),
};

export default class {
    #app;
    #config;
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
    async init () {

        // validate notifications config
        this.#types = this.config.types || {};

        // internal notifications
        this.#channels.internal = this.config.internalNotificationsEnabled;

        // email notifications
        if ( this.config.smtp ) {
            this.#channels.email = this.config.emailNotificationsEnabled;
            this.#smtp = new Smtp( this.config.smtp );
        }
        else {
            this.#channels.email = false;
        }

        // telegram notifications
        if ( this.config.telegramBot.apiKey ) {
            this.#channels.telegram = this.config.telegramNotificationsEnabled;
        }
        else {
            this.#channels.telegram = false;
        }

        // push notifications
        if ( this.config.firebase?.serviceAccount ) {
            this.#channels.push = this.config.pushNotificationsEnabled;
            this.#pushNotificationsPrefix = this.config.firebase.prefix ? this.config.firebase.prefix + "." : "";
            this.#googleCloudMessagingApi = new GoogleCloudMessagingApi( this.config.firebase.serviceAccount );
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

    async run () {
        if ( this.internalNotificationsEnabled ) {
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

    // XXX wait for push, telegram, internal...
    async shutDown () {
        if ( this.#smtp ) await this.#smtp.shutDown();
    }

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

    // XXX
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
                internalUsers.push( user );
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

        // internal
        if ( internalUsers.length ) {
            promises.push( this.#sendInternalNotification( internalUsers, subject, body, options.internal ) );
        }

        // email
        if ( emails.length ) {
            for ( const email of emails ) {
                promises.push( this.sendEmail( email, subject, body, options.email ) );
            }
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

    // private
    get #telegramBot () {
        return this.app.telegram.getBot( this.#telegramBotId );
    }

    async #sendInternalNotification ( users, subject, body, { maxAge } = {} ) {

        // service not available
        if ( !this.internalNotificationsEnabled ) return result( 503 );

        if ( maxAge === undefined ) maxAge = this.config.internalNotificationsMaxAge;

        if ( maxAge ) {
            var expires = new Date( Date.now() + maxAge * 1000 );
        }

        const locales = {},
            userId = [];

        for ( const user of users ) {
            userId.push( user.id );

            locales[user.locale] ??= {
                "users": [],
                "subject": subject instanceof LocaleTemplate ? subject.toString( { "domain": user.locale } ) : subject,
                "body": body instanceof LocaleTemplate ? body.toString( { "domain": user.locale } ) : body,
            };

            locales[user.locale].users.push( user.id );
        }

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
            this.app.publish( "/api/notifications/update/", userId, { "inbox": true, "done": false } );
        } );

        return res;
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

                this.app.publish( "/api/notifications/update/" + userId, row );
            }
        }

        if ( mutex ) await mutex.up();
    }
}
