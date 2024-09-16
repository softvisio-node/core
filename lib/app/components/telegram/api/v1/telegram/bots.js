import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";

const STATS_PERIODS = {
    "7 days": "hour",
    "3 months": "day",
    "1 year": "day",
};

const SQL = {
    "getBot": sql`
SELECT
    *,
    ? || id AS avatar_url,
    acl_user_permissions( acl_id, ? )
FROM
    telegram_bot
WHERE
    id = ?
`.prepare(),

    "getBotStats": sql`WITH params AS (
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
        telegram_bot_stats
    WHERE
        telegram_bot_id = ?
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
        telegram_bot_stats
    WHERE
        telegram_bot_id = ?
        AND date <= ( SELECT start FROM params )
    ORDER BY
        telegram_bot_stats.date DESC
    LIMIT 1
),
"end" AS (
    SELECT
        ( SELECT "end" FROM params ) AS date,
        total_subscribed_users,
        total_unsubscribed_users
    FROM
        telegram_bot
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

export default Super =>
    class extends Super {

        // public
        async API_getBotsList ( ctx, options = {} ) {
            const where = sql.where();

            if ( options.where?.name ) {
                where.and( { "name": options.where.name }, `OR`, { "username": options.where.name } );

                delete options.where.name;
            }

            where.and( options.where );

            const query = sql`
WITH bots AS (
    SELECT
        telegram_bot.*
    FROM
        telegram_bot
    WHERE
        acl_has_user( telegram_bot.acl_id, ${ ctx.user.id } )
)
SELECT
    id,
    type,
    static,
    deleted,
    name,
    username,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    started,
    error,
    error_text,
    ${ this.app.telegram.config.avatarUrl } || id AS avatar_url
FROM
    bots
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async API_getRegisteredComponents ( ctx ) {
            return result(
                200,
                [ ...this.app.telegram.bots.telegramComponents.values() ].map( component => {
                    return {
                        "id": component.io,
                        "name": component.config.telegram.name,
                        "description": component.config.telegram.description,
                        "short_description": component.config.telegram.shortDescription,
                        "locales": component.locales,
                    };
                } )
            );
        }

        async API_checkBotApiToken ( ctx, apiToken ) {
            const api = new TelegramBotApi( apiToken );

            var res = await api.getMe();
            if ( !res.ok ) return res;

            const bot = res.data;

            res = await this.dbh.selectRow( sql`SELECT id FROM telegram_bot WHERE id = ?`, [ bot.id ] );
            if ( !res.ok ) return res;

            if ( res.data ) return result( [ 400, `Bot already exists` ] );

            return result( 200, bot );
        }

        async API_createBot ( ctx, apiToken, type ) {
            return this.app.telegram.bots.createBot( {
                apiToken,
                type,
                "ownerUserId": ctx.user.isRoot
                    ? null
                    : ctx.user.id,
            } );
        }

        async API_getBot ( ctx, botId ) {
            return this.dbh.selectRow( SQL.getBot, [

                //
                this.app.telegram.config.avatarUrl,
                ctx.user.id,
                botId,
            ] );
        }

        async API_getBotStats ( ctx, botId, period ) {
            return this.dbh.select( SQL.getBotStats, [

                //
                period,
                STATS_PERIODS[ period ],
                botId,
                botId,
                botId,
            ] );
        }

        async API_setBotStarted ( ctx, botId, started ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 404, `Bot not found` ] );

            return bot.setStarted( started );
        }

        async API_setBotApiToken ( ctx, botId, botApiToken ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 404, `Bot not found` ] );

            return bot.setApiToken( botApiToken );
        }

        async API_updateBotDetails ( ctx, botId, options ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( 404 );

            var res;

            // name
            if ( options.name != null && options.name !== bot.name ) {
                res = await this.dbh.begin( async dbh => {
                    res = await dbh.do( sql`UPDATE telegram_bot SET name = ? WHERE id = ?`, [

                        //
                        options.name,
                        botId,
                    ] );
                    if ( !res.ok ) throw res;

                    res = await bot.api.setMyName( {
                        "name": options.name,
                    } );
                    if ( !res.ok ) throw res;
                } );

                if ( !res.ok ) return res;
            }

            // short description
            if ( options.short_description != null && options.short_description !== bot.shortDescription ) {
                res = await this.dbh.begin( async dbh => {
                    res = await dbh.do( sql`UPDATE telegram_bot SET short_description = ? WHERE id = ?`, [

                        //
                        options.short_description,
                        botId,
                    ] );
                    if ( !res.ok ) throw res;

                    res = await bot.api.setMyShortDescription( {
                        "short_description": options.short_description,
                    } );
                    if ( !res.ok ) throw res;
                } );

                if ( !res.ok ) return res;
            }

            // description
            if ( options.description != null && options.description !== bot.description ) {
                res = await this.dbh.begin( async dbh => {
                    res = await dbh.do( sql`UPDATE telegram_bot SET description = ? WHERE id = ?`, [

                        //
                        options.description,
                        botId,
                    ] );
                    if ( !res.ok ) throw res;

                    res = await bot.api.setMyDescription( {
                        "description": options.description,
                    } );
                    if ( !res.ok ) throw res;
                } );

                if ( !res.ok ) return res;
            }

            return result( 200 );
        }

        async API_deleteBot ( ctx, botId ) {
            return this.app.telegram.bots.deleteBot( botId );
        }
    };
