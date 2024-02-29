import sql from "#lib/sql";

const STATS_PERIODS = {
    "7 days": "hour",
    "3 months": "day",
    "1 year": "day",
};

const SQL = {
    "createLinkId": sql`SELECT nextval( 'telegram_bot_link_id_seq' ) AS id`,

    "createLink": sql`
INSERT INTO
    telegram_bot_link
(
    id,
    telegram_bot_id,
    start_param,
    name,
    description
)
VALUES ( ?, ?, ?, ?, ? )
RETURNING
    id,
    name,
    description,
    start_param
`,

    "updateLink": sql`
UPDATE
    telegram_bot_link
SET
    name = coalesce( ?, name ),
    description = coalesce( ?, description )
WHERE
    id = ?
    AND telegram_bot_id = ?
`,

    "deleteLink": sql`DELETE FROM telegram_bot_link WHERE id = ? AND telegram_bot_id = ?`.prepare(),

    "getLinkStats": sql`WITH params AS (
    WITH args AS ( SELECT ?::interval AS interval, ?::text AS step ),
    step_interval AS ( SELECT ( '1 ' || ( SELECT step FROM args ) )::interval AS interval )
    SELECT
        ( SELECT step FROM args ) AS step,
        ( SELECT interval FROM step_interval ) AS step_interval,
        ( date_trunc( ( SELECT step FROM args ), CURRENT_TIMESTAMP ) - ( SELECT interval FROM args ) + ( SELECT interval FROM step_interval ) ) AS start,
        date_trunc( ( SELECT step FROM args ), CURRENT_TIMESTAMP ) AS end
),
series AS (
    SELECT date FROM generate_series(
        ( SELECT start FROM params ),
        ( SELECT "end" FROM params ),
        ( SELECT step_interval FROM params )
    ) AS date
),
stats AS (
    SELECT
        date_trunc( ( SELECT step FROM params ), date ) AS truncated_date,
        max( total_subscribed_users ) AS total_subscribed_users,
        max( total_unsubscribed_users ) AS total_unsubscribed_users,
        sum( total_subscribed_users_delta )::int4 AS total_subscribed_users_delta,
        sum( total_unsubscribed_users_delta )::int4 AS total_unsubscribed_users_delta
    FROM
        telegram_bot_link_stats
    WHERE
        telegram_bot_link_id = ?
        AND date >= ( SELECT start FROM params )
    GROUP BY
        truncated_date
),
start AS (
    SELECT
        ( SELECT start FROM params ) AS date,
        total_subscribed_users,
        total_unsubscribed_users
    FROM
        telegram_bot_link_stats
    WHERE
        telegram_bot_link_id = ?
        AND date <= ( SELECT start FROM params )
    ORDER BY
        date DESC
    LIMIT 1
),
"end" AS (
    SELECT
        ( SELECT "end" FROM params ) AS date,
        total_subscribed_users,
        total_unsubscribed_users
    FROM
        telegram_bot_link
    WHERE
        id = ?
)
SELECT
    series.date,
    coalesce(
        "end".total_subscribed_users,
        stats.total_subscribed_users,
        start.total_subscribed_users
    ) AS total_subscribed_users,

    0 - coalesce(
        "end".total_unsubscribed_users,
        stats.total_unsubscribed_users,
        start.total_unsubscribed_users
    ) AS total_unsubscribed_users,

    CASE
        WHEN total_subscribed_users_delta > 0 THEN total_subscribed_users_delta
        ELSE 0
    END AS total_subscribed_users_delta,

    CASE
        WHEN total_unsubscribed_users_delta > 0 THEN 0 - total_unsubscribed_users_delta
        ELSE 0
    END AS total_unsubscribed_users_delta
FROM
    series
    LEFT JOIN stats ON ( series.date = stats.truncated_date )
    LEFT JOIN start ON ( series.date = start.date )
    LEFT JOIN "end" ON ( series.date = "end".date )
`.prepare(),
};

export default class {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    async createLink ( { name, description, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.begin( async dbh => {
            var res;

            res = await dbh.selectRow( SQL.createLinkId );

            if ( !res.ok ) throw res;

            const linkId = res.data.id;

            res = await dbh.selectRow( SQL.createLink, [

                //
                linkId,
                this.bot.id,
                this.app.telegram.encodeCallbackData( linkId ),
                name || new Date(),
                description,
            ] );

            if ( !res.ok ) throw res;

            return res;
        } );
    }

    async updateLink ( linkId, { name, description, dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.do( SQL.updateLink, [ name, description, linkId, this.bot.id ] );

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 404 );

        return res;
    }

    async deleteLink ( linkId, { dbh } = {} ) {
        dbh ||= this.sbh;

        const res = await dbh.do( SQL.delete, [ linkId, this.bot.id ] );

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 404 );

        return res;
    }

    async getLinkStats ( linkId, period ) {
        return this.dbh.select( SQL.getLinkStats, [

            //
            period,
            STATS_PERIODS[ period ],
            linkId,
            linkId,
            linkId,
        ] );
    }
}
