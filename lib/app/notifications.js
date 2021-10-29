import sql from "#lib/sql";
import Smtp from "#lib/api/smtp";

const QUERIES = {
    "insert": sql`INSERT INTO notification (subject, body, meta, expires) VALUES (?, ?, ?, ?) RETURNING "id"`.prepare(),
    "clear": sql`DELETE FROM notification WHERE expires <= CURRENT_TIMESTAMP`.prepare(),
};

export default class Notifications {
    #app;
    #smtp;

    constructor ( app ) {
        this.#app = app;

        setInterval( () => this.dbh.do( QUERIES.clear ), 1000 * 60 * 60 * 24 );
    }

    // properties
    get dbh () {
        return this.#app.dbh;
    }

    // public
    async sendNotification ( users, subject, body, options = {} ) {
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
    async sendPushNotification () {}
}
