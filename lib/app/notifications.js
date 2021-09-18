import sql from "#lib/sql";

export default class Notifications {
    #app;

    constructor ( app ) {
        this.#app = app;

        // setInterval( () => {
        //     this.sendUI( ["1"], "Test", "In publishing and graphic design." );

        //     // this.sendUI( ["1"], "Test", "In publishing and graphic design, Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying ..." );
        // }, 10000 );
    }

    // properties
    get dbh () {
        return this.#app.dbh;
    }

    // public
    async get ( ctx ) {
        const res = await this.dbh.select( sql`
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
ORDER BY
    "date" DESC
LIMIT 20
`,
        [ctx.userId] );

        return res;
    }

    // XXX /api event
    async sendUI ( users, subject, body ) {
        const res = await this.dbh.begin( async dbh => {
            var res;

            res = await dbh.selectRow( sql`INSERT INTO "notification" ("subject", "body") VALUES (?, ?) RETURNING "id"`, [subject, body] );

            if ( !res.ok ) throw res;

            const notification_id = res.data.id;

            res = await dbh.do( sql`INSERT INTO "notification_user"`.VALUES( users.map( user_id => {
                return {
                    notification_id,
                    user_id,
                };
            } ) ) );

            if ( !res.ok ) throw res;

            this.#app.publish( "api", users, "notifications" );
        } );

        return res;
    }

    async markRead ( userId, notifications ) {
        const res = await this.dbh.do( sql`UPDATE "notification_user" SET "read" = TRUE WHERE "user_id" = ${userId} AND "notification_id"`.IN( notifications ) );

        return res;
    }
}
