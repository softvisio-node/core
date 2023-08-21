import sql from "#lib/sql";
import uuid from "#lib/uuid";

const STATS_PERIODS = {
    "week": {
        "step": "hour",
        "period": { "days": 70 },
    },
    "month": {
        "step": "day",
        "period": { "days": 30 },
    },
    "year": {
        "step": "month",
        "period": { "months": 12 },
    },
};

const SQL = {
    "getBot": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "getBotStats": sql`
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
        date_trunc( ?, date ) AS date,

        max( total_users ) AS total_users,
        greatest( 0, sum( total_users_delta )::int53 ) AS total_users_delta,

        max( total_subscribed_users ) AS total_subscribed_users,
        greatest( 0, sum( total_subscribed_users_delta )::int53 ) AS total_subscribed_users_delta,

        max( total_unsubscribed_users ) AS total_unsubscribed_users,
        greatest( 0, sum( total_unsubscribed_users_delta )::int53 ) AS total_unsubscribed_users_delta,

        max( total_returned_users ) AS total_returned_users,
        greatest( 0, sum( total_returned_users_delta )::int53 ) AS total_returned_users_delta
    FROM
        telegram_bot_stats
    WHERE
        telegram_bot_id = ?
        AND date >= ( SELECT min( date ) FROM dates )
    GROUP BY
        date
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
    LEFT JOIN series ON ( dates.date = series.date )
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
        date_trunc( ?, date ) AS date,

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
        date
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
    LEFT JOIN series ON ( dates.date = series.date )
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
        return this.#getStats( SQL.getBotStats, STATS_PERIODS[period] );
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

    // XXX
    async getAdCampaignStats ( id ) {
        const step = "day",
            period = { "days": 30 };

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

    // private
    // XXX add current values to the last period
    async #getStats ( query, { step, period } = {} ) {
        return this.dbh.select( query, [

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
            this.bot.id,
        ] );
    }
}
