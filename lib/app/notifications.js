import sql from "#lib/sql";

const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 2; // 2 days

const QUERIES = {
    "get": sql`
SELECT
    "notification"."id",
    "notification"."date",
    "notification"."subject",
    "notification"."body",
    "notification_user"."read" AS "read"
FROM
    "notification",
    "notification_user"
WHERE
    "notification"."id" = "notification_user"."notification_id"
    AND "notification_user"."user_id" = ?
    AND "notification_user"."deleted" = FALSE
    AND "notification"."expires" > CURRENT_TIMESTAMP
ORDER BY
    "date" DESC
LIMIT 100
`,
    "insert": sql`INSERT INTO "notification" ("subject", "body", "expires") VALUES (?, ?, ?) RETURNING "id"`.prepare(),
    "clear": sql`DELETE FROM "notification" WHERE "expires" <= CURRENT_TIMESTAMP`.prepare(),
};

export default class Notifications {
    #app;

    constructor ( app ) {
        this.#app = app;

        setInterval( () => this.dbh.do( QUERIES.clear ), 1000 * 60 * 60 * 24 );
    }

    // properties
    get dbh () {
        return this.#app.dbh;
    }

    // public
    async get ( ctx ) {
        const res = await this.dbh.select( QUERIES.get, [ctx.userId] );

        return res;
    }

    async sendUI ( users, subject, body, options = {} ) {
        const res = await this.dbh.begin( async dbh => {
            var res;

            const expires = new Date();
            expires.setTime( expires.getTime() + ( options.maxAge || DEFAULT_MAX_AGE ) );

            res = await dbh.selectRow( QUERIES.insert, [subject, body, expires] );

            if ( !res.ok ) throw res;

            const notification_id = res.data.id;

            res = await dbh.do( sql`INSERT INTO "notification_user"`.VALUES( users.map( user_id => {
                return {
                    notification_id,
                    user_id,
                };
            } ) ) );

            if ( !res.ok ) throw res;

            this.#app.publish( "/api", users, "notifications" );
        } );

        return res;
    }

    async sendEmail () {}

    async sendPush () {}

    async markRead ( userId, notifications ) {
        const res = await this.dbh.do( sql`UPDATE "notification_user" SET "read" = TRUE WHERE "user_id" = ${userId} AND "notification_id"`.IN( notifications ) );

        return res;
    }

    async markUnread ( userId, notifications ) {
        const res = await this.dbh.do( sql`UPDATE "notification_user" SET "read" = FALSE WHERE "user_id" = ${userId} AND "notification_id"`.IN( notifications ) );

        return res;
    }

    async delete ( userId, notifications ) {
        if ( !Array.isArray( notifications ) ) notifications = [notifications];

        const res = await this.dbh.do( sql`UPDATE "notification_user" SET "deleted" = TRUE WHERE "user_id" = ${userId} AND "notification_id"`.IN( notifications ) );

        return res;
    }
}
