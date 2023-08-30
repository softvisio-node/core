import sql from "#lib/sql";

const STATS_PERIODS = {
    "7 days": {
        "step": "hour",
        "stepMethod": "Hours",
        "period": 7,
        "periodMethod": "Date",
    },
    "3 months": {
        "step": "day",
        "stepMethod": "Date",
        "period": 3,
        "periodMethod": "Month",
    },
    "1 year": {
        "step": "day",
        "stepMethod": "Date",
        "period": 12,
        "periodMethod": "Month",
    },
};

const SQL = {
    "getBot": sql`
SELECT
    *,
    acl_user_permissions( acl_id, ? )
FROM
    telegram_bot
WHERE
    id = ?
`.prepare(),

    "getBotStats": sql`
WITH series AS (
    SELECT
        truncated_date AS date,

        max( total_users ) AS total_users,
        greatest( 0, sum( total_users_delta )::int53 ) AS total_users_delta,

        max( total_subscribed_users ) AS total_subscribed_users,
        greatest( 0, sum( total_subscribed_users_delta )::int53 ) AS total_subscribed_users_delta,

        0 - max( total_unsubscribed_users ) AS total_unsubscribed_users,
        ( 0 - greatest( 0, sum( total_unsubscribed_users_delta ) )::int53 ) AS total_unsubscribed_users_delta,

        max( total_returned_users ) AS total_returned_users,
        greatest( 0, sum( total_returned_users_delta )::int53 ) AS total_returned_users_delta
    FROM (
        SELECT
            *,
            date_trunc( ?, date ) AS truncated_date
        FROM
            telegram_bot_stats
        WHERE
            telegram_bot_id = ?
            AND date >= ?
    ) AS t
    GROUP BY
        truncated_date
    ORDER BY
        date
)
SELECT
    ( SELECT json_agg( series ) FROM series ) AS series,

    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot_stats WHERE telegram_bot_id = ? AND date < ? ORDER BY date DESC LIMIT 1 ) AS row ) AS start,

    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot WHERE id = ? ) AS row ) AS end
`.prepare(),
};

export default Super =>
    class extends Super {

        // public
        async API_read ( ctx, options = {} ) {
            const where = sql.where();

            if ( options.where?.name ) {
                where.and( { "name": options.where.name }, `OR`, { "telegram_username": options.where.name } );

                delete options.where.name;
            }

            where.and( options.where );

            const query = sql`
WITH bots AS (
    SELECT
        telegram_bot.*
    FROM
        telegram_bot,
        acl_user
    WHERE
        telegram_bot.acl_id = acl_user.acl_id
        AND acl_user.user_id = ${ctx.user.id}
        AND acl_user.enabled

)
SELECT
    id,
    type,
    static,
    name,
    telegram_username,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    started,
    error,
    error_text
FROM
    bots
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async API_getBot ( ctx, botId ) {
            return this.dbh.selectRow( SQL.getBot, [ctx.user.id, botId] );
        }

        async API_getBotStats ( ctx, botId, period ) {
            period = STATS_PERIODS[period];

            const start = new Date();

            start.setMilliseconds( 0 );
            start.setSeconds( 0 );
            start.setMinutes( 0 );

            if ( period.step === "day" ) {
                start.setHours( 0 );
            }

            const end = new Date( start.getTime() );

            start["set" + period.periodMethod]( start["get" + period.periodMethod]() - period.period );
            start["set" + period.stepMethod]( start["get" + period.stepMethod]() + 1 );

            const res = await this.dbh.selectRow(
                SQL.getBotStats,

                [

                    // series
                    period.step,
                    botId,
                    start,

                    // start
                    botId,
                    start,

                    // end
                    botId,
                ]
            );

            if ( !res.ok ) return res;

            // bot not found
            if ( !res.data.end ) return result( 404 );

            const data = res.data.series || [];

            // start date
            if ( !data[0]?.date || Date.parse( data[0].date ) !== start.getTime() ) {
                data.unshift( {
                    "date": start,
                    ...( res.data.start || {} ),
                } );

                data[0].total_unsubscribed_users = 0 - data[0].total_unsubscribed_users;
            }

            // end date
            if ( Date.parse( data.at( -1 ).date ) === end.getTime() ) {
                data[data.length - 1] = {
                    ...data.at( -1 ),
                    ...res.data.end,
                };

                data[data.length - 1].total_unsubscribed_users = 0 - data[data.length - 1].total_unsubscribed_users;
            }
            else {
                data.push( {
                    "date": end,
                    ...res.data.end,
                } );

                data[data.length - 1].total_unsubscribed_users = 0 - data[data.length - 1].total_unsubscribed_users;
            }

            return result( 200, data );
        }

        async API_setBotStarted ( ctx, botId, started ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( [404, `Bot not found`] );

            return bot.setStarted( started );
        }

        async API_updateBotDetails ( ctx, botId, options ) {
            const bot = this.app.telegram.getBot( botId );

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

                    res = await bot.telegramBotApi.setMyName( {
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

                    res = await bot.telegramBotApi.setMyShortDescription( {
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

                    res = await bot.telegramBotApi.setMyDescription( {
                        "description": options.description,
                    } );
                    if ( !res.ok ) throw res;
                } );

                if ( !res.ok ) return res;
            }

            return result( 200 );
        }

        async API_deleteBot ( ctx, botId ) {
            return this.app.telegram.deleteBot( botId );
        }
    };
