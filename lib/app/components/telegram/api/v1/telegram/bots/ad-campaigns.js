import sql from "#lib/sql";
import uuid from "#lib/uuid";

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
    "create": sql`
INSERT INTO
    telegram_bot_ad_campaign
SET
    telegram_bot_id = ?,
    guid = ?,
    callback = ?,
    name = ?,
    description = ?
`,

    // XXX
    "getStats": sql`
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

    "delete": sql`DELETE FROM telegram_bot_ad_campaign WHERE id = ? AND telegram_bot_id = ?`.prepare(),
};

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const bot = this.app.telegram.get( options.where.telefram_bot_id[1] );

            if ( !bot ) return result( 404 );

            const where = sql.where( options.where );

            const query = sql`
SELECT
    id,
    name,
    description,
    created,
    callback,
    ${bot.telegramUsername} AS telegram_bot_username,

    last_user_created,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    total_returned_users,
    total_banned_users
FROM
    telegram_bot_ad_campaign
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async API_createAdCampaign ( ctx, botId, { name, description } = {} ) {
            const guid = uuid();

            return this.dbh.do( SQL.create, [

                //
                botId,
                guid,
                this.app.telegram.encodeCallback( "ad-campaign", guid ),
                name,
                description,
            ] );
        }

        // XXX
        async API_getAdCampaign ( ctx, botId, adCampaignId ) {}

        // XXX
        async API_getAdCampaignStats ( ctx, botId, adCampaignId, period ) {
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

        async API_updateAdCampaign ( ctx, botId, adCampaignId, values ) {
            const res = await this.dbh.do( sql`UPDATE telegram_bot_ad_campaign`.SET( values ).sql`WHERE id = ${adCampaignId} AND telegram_bot_id = ${botId}` );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return res;
        }

        async API_deleteAdCampaign ( ctx, botId, adCampaignId ) {
            const res = await this.dbh.do( SQL.delete, [adCampaignId, botId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return res;
        }
    };
