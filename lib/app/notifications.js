import sql from "#lib/sql";

export default class Notifications {
    #app;

    constructor ( app ) {
        this.#app = app;
    }

    // properties
    get dbh () {
        return this.#app.dbh;
    }

    // public
    async get ( ctx ) {
        const res = await this.dbh.selectAll( sql`
SELECT
    "notification"."id",
    "notification"."date",
    "notification"."subject",
    "notification"."body"
FROM
    "notification",
    "notification_user"
WHERE
    "notification"."id" = "notification_user"."notification_id"
    AND "notification_user"."user_id" = ?
ORDER BY
    "date" DESC
`,
        [ctx.userId] );

        return res;
    }

    async send ( type, users, subject, body ) {
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

            this.#app.publish( "/api", users, "notification" );
        } );

        return res;
    }
}
