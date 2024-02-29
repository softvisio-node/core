import sql from "#lib/sql";

const STATS_PERIODS = {
    "7 days": "hour",
    "3 months": "day",
    "1 year": "day",
};

const SQL = {
    "getLink": sql`
SELECT
   id,
    name,
    description,
    created,
    'https://t.me/' || ( SELECT username FROM telegram_bot WHERE id = telegram_bot_id ) || ? || start_param AS link,
    last_user_created,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    total_returned_users,
    total_banned_users
FROM
    telegram_bot_link
WHERE
    id = ?
`.prepare(),

    "create": sql`
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
`,

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

    "delete": sql`DELETE FROM telegram_bot_link WHERE id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        async API_getLinksList ( ctx, options ) {
            const where = sql.where( options.where );

            const query = sql`
SELECT
    id,
    name,
    description,
    created,
    'https://t.me/' || ( SELECT username FROM telegram_bot WHERE id = telegram_bot_id ) || ${ "?start=" } || start_param AS link,
    last_user_created,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    total_returned_users,
    total_banned_users
FROM
    telegram_bot_link
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async API_getLink ( ctx, linkId ) {
            return this.dbh.selectRow( SQL.getLink, [ "?start=", linkId ] );
        }

        async API_createLink ( ctx, botId, { name, description } ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.createLink( { name, description } );
        }

        async API_getLinkStats ( ctx, linkId, period ) {
            return this.dbh.select( SQL.getLinkStats, [

                //
                period,
                STATS_PERIODS[ period ],
                linkId,
                linkId,
                linkId,
            ] );
        }

        async API_updateLink ( ctx, botId, linkId, fields ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.updateLink( linkId, fields );
        }

        async API_deleteLink ( ctx, botId, linkId ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.deleteLink( linkId );
        }
    };
