import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";
import TelegramBot from "#lib/api/telegram/bot";

const QUERIES = {
    "insert": sql`INSERT INTO notification (subject, body, meta, expires) VALUES (?, ?, ?, ?) RETURNING "id"`.prepare(),
    "clear": sql`DELETE FROM notification WHERE expires <= CURRENT_TIMESTAMP`.prepare(),
};

// const CHANNELS = ["internal", "email", "telegram", "push"];
// const ENABLED_CHANNELS = CHANNELS;

export default class Notifications {
    #app;
    #categories;
    #smtp;
    #telegram;

    #emailEnabled;
    #telegramEnabled;
    #pushEnabled;

    constructor ( app ) {
        this.#app = app;

        // init email
        if ( process.env.TELEGRAM_BOT_KEY ) {
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

    // XXX
    async send ( type, users, subject, body ) {
        for ( const userId of users ) {
            const channels = await this.#getUserNotificationChannels( userId, type );

            for ( const channel of channels ) {
                if ( channel === "internal" ) this.sendInternalNotification();
            }
        }
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

            res = await dbh.do( sql`INSERT INTO user_notification`.VALUES( users.map( userId => {
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

    async sendEmail ( options = {} ) {
        if ( !this.#smtp ) {
            this.#smtp = new Smtp( {
                "hostname": process.env.APP_SMTP_HOSTNAME,
                "port": +process.env.APP_SMTP_PORT,
                "username": process.env.APP_SMTP_USERNAME,
                "password": process.env.APP_SMTP_PASSWORD,
            } );
        }

        if ( !options.from && process.env.APP_SMTP_FROM ) options = { ...options, "from": process.env.APP_SMTP_FROM };

        return this.#smtp.sendEmail( options );
    }

    // XXX
    async sendTelegramNotification () {}

    // XXX
    async sendPushNotification () {}

    // private
    // XXX
    async #getUserNotificationChannels ( userId, type ) {
        return { "telegram": true };
    }

    // XXX update chat_id
    #onTelegramMessage ( data ) {
        const chatId = data.message.chat.id,
            telegramUsername = data.message.chat.username;

        console.log( telegramUsername );

        // this.dbh.do( sql`INSERT INTO user_telegram SET chat_id = ? FROM "user" WHERE "user".id = user_telegram.user_id AND "user".telegram_username = ? ON CONFLICT ( user_id ) DO UPDATE SET chat_id = ?`, [chatId, telegramUsername, chatId] );

        this.#telegram.sendMessage( chatId, `This bot doesn't support any commands. To stop receiving notifications just delete this chat.` );
    }
}
