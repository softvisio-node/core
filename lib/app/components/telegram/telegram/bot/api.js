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
    "getBot": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

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
    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot WHERE id = ? ) AS row ) AS end,
    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot_stats WHERE telegram_bot_id = ? AND date < ? ORDER BY date DESC LIMIT 1 ) AS row ) AS start
`.prepare(),

    "getBotAdCampaignStats": sql`
WITH dates AS (
    SELECT
        generate_series(
            date_trunc( ?, CURRENT_TIMESTAMP - make_interval( months => ?, days => ?, hours => ? ) + make_interval( months => ?, days => ?, hours => ? ) ),
            date_trunc( ?, CURRENT_TIMESTAMP ),
            make_interval( months => ?, days => ?, hours => ? )
        ) AS date
),
series AS (
    SELECT
        date_trunc( ?, date ) AS date1,

        max( total_users ) AS total_users,
        greatest( 0, sum( total_users_delta )::int53 ) AS total_users_delta,

        max( total_subscribed_users ) AS total_subscribed_users,
        greatest( 0, sum( total_subscribed_users_delta )::int53 ) AS total_subscribed_users_delta,

        max( total_unsubscribed_users ) AS total_unsubscribed_users,
        greatest( 0, sum( total_unsubscribed_users_delta )::int53 ) AS total_unsubscribed_users_delta,

        max( total_returned_users ) AS total_returned_users,
        greatest( 0, sum( total_returned_users_delta )::int53 ) AS total_returned_users_delta
    FROM
        telegram_bot_ad_campaign_stats
    WHERE
        telegram_bot_ad_campaign_id = ?
        AND date >= ( SELECT min( date ) FROM dates )
    GROUP BY
        date1
)
SELECT
    dates.date,
    series.total_users,
    series.total_users_delta,
    series.total_subscribed_users,
    series.total_subscribed_users_delta,
    series.total_unsubscribed_users,
    series.total_unsubscribed_users_delta,
    series.total_returned_users,
    series.total_returned_users_delta
FROM
    dates
    LEFT JOIN series ON ( dates.date = series.date1 )
`.prepare(),

    "createAdCampaign": sql`
INSERT INTO
    telegram_bot_ad_campaign
(
    telegram_bot_id,
    guid,
    callback_param,
    name,
    description
)
VALUES ( ?, ?, ?, ?, ? )
`.prepare(),

    "updateAdCampaign": sql`
UPDATE
    telegram_bot_ad_campaign
SET
    name = ? OR name,
    description = ? OR descriptions
WHERE
    id = ?
    AND telegram_bot_id = ?
    `.prepare(),

    "deleteAdCampaign": sql`DELETE FROM telegram_bot_ad_campaign WHERE id = ? AND telegram_bot_id = ?`.prepare(),
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
    async getBot () {
        return this.dbh.selectRow( SQL.getBot, [this.#bot.id] );
    }

    async getBotStats ( period ) {
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

                //
                period.step,
                this.#bot.id,
                start,
                this.#bot.id,
                this.#bot.id,
                start,
            ]
        );

        if ( !res.ok ) return res;

        // bot not found
        if ( !res.data.end ) return result( 404 );

        const data = res.data.series || {};

        // start date
        if ( !data[0]?.date || Date.parse( data[0].date ) !== start.getTime() ) {
            data.unshift( {
                "date": start,
                ...res.data.start,
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

    async createAdCampaign ( { name, description } = {} ) {
        const guid = uuid(),
            callbackPatam = this.#bot.telegram.encodeCallback( "ad-campaign", guid );

        return this.dbh.do( SQL.createAdCampaign, [

            //
            this.#bot.id,
            guid,
            callbackPatam,
            name,
            description,
        ] );
    }

    // XXX compose url
    async readAdCampaigns () {}

    async updateAdCampaign ( id, { name, description } = {} ) {
        return this.dbh.do( SQL.updateAdCampaign, [name, description, id, this.#bot.id] );
    }

    async deleteAdCampaign ( id ) {
        return this.dbh.do( SQL.deleteAdCampaign, [id, this.#bot.id] );
    }

    // XXX add current values to the last period
    async getAdCampaignStats ( id, period ) {
        var step;

        ( { step, period } = STATS_PERIODS[period] );

        return this.dbh.select( SQL.getBotAdCampaignStats, [

            //
            step,
            period.months || 0,
            period.days || 0,
            period.hours || 0,
            step === "month" ? 1 : 0,
            step === "day" ? 1 : 0,
            step === "hour" ? 1 : 0,

            //
            step,
            step === "month" ? 1 : 0,
            step === "day" ? 1 : 0,
            step === "hour" ? 1 : 0,

            step,
            id,
        ] );
    }
}
