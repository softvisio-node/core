import sql from "#lib/sql";

const SQL = {
    "getLink": sql`
SELECT
   id,
    name,
    description,
    created,
    'https://t.me/' || ( SELECT telegram_username FROM telegram_bot WHERE id = telegram_bot_id ) || ? || start_param AS link,
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
    telegram_bot_id,
    guid,
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
        async API_getUsersList ( ctx, options ) {
            const where = sql.where( `telegram_user.id = telegram_bot_user.telegram_user_id` );

            if ( options.where?.search ) {
                const search = options.where.search;
                delete options.where.search;

                where.and(

                    //
                    { "username": search },
                    "OR",
                    { "first_name": search },
                    "OR",
                    { "last_name": search },
                    "OR",
                    { "phone": search },
                    "OR",
                    { "user.email": search }
                );
            }

            where.and( options.where );

            const query = sql`
SELECT
    telegram_bot_user.id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,
    telegram_bot_user.created,
    telegram_bot_user.last_activity,
    telegram_bot_user.subscribed,
    telegram_bot_user.returned,
    telegram_bot_user.banned,
    ${this.app.telegram.config.avatarLocation + "/"} || telegram_bot_user.telegram_bot_id || '/' || telegram_bot_user.id AS avatar_url,
    telegram_bot_user.api_user_id,
    "user".email AS api_user_email,
    CASE
        WHEN telegram_bot_user.api_user_id IS NOT NULL THEN 'https://s.gravatar.com/avatar/' || "user".gravatar || ${"?d=" + this.app.users.config.defaultGravatarParam}
        ELSE ${this.app.users.config.defaultGravatarUrl}
    END AS api_user_avatar_url
FROM
    telegram_user,
    telegram_bot_user
    LEFT JOIN "user" ON ( telegram_bot_user.api_user_id = "user".id )
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        // XXX
        async API_getUser ( ctx, linkId ) {
            return this.dbh.selectRow( SQL.getLink, ["?start=", linkId] );
        }

        // XXX
        async API_updateUser ( ctx, linkId, values ) {
            const res = await this.dbh.do( sql`UPDATE telegram_bot_link`.SET( values ).sql`WHERE id = ${linkId}` );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return res;
        }
    };
