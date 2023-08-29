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

    "getBotAdCampaignStats": sql`
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
            telegram_bot_ad_campaign_stats
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

    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot_stats WHERE telegram_bot_ad_campaign_id = ? AND date < ? ORDER BY date DESC LIMIT 1 ) AS row ) AS start,

    ( SELECT row_to_json( row ) FROM ( SELECT total_users, total_subscribed_users, total_unsubscribed_users, total_returned_users FROM telegram_bot_ad_campaign WHERE id = ? AND telegram_bot_id = ? ) AS row ) AS end
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
    async getBot ( userId ) {
        return this.dbh.selectRow( SQL.getBot, [userId, this.#bot.id] );
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

                // series
                period.step,
                this.#bot.id,
                start,

                // start
                this.#bot.id,
                start,

                // end
                this.#bot.id,
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

    async updateBotDetails ( values ) {
        var res;

        // name
        if ( values.name != null && values.name !== this.#bot.name ) {
            res = await this.dbh.begin( async dbh => {
                res = await dbh.do( sql`UPDATE telegram_bot SET name = ? WHERE id = ?`, [

                    //
                    values.name,
                    this.#bot.id,
                ] );
                if ( !res.ok ) throw res;

                res = await this.#bot.telegramBotApi.setMyName( {
                    "name": values.name,
                } );
                if ( !res.ok ) throw res;
            } );

            if ( !res.ok ) return res;
        }

        // short description
        if ( values.short_description != null && values.short_description !== this.#bot.shortDescription ) {
            res = await this.dbh.begin( async dbh => {
                res = await dbh.do( sql`UPDATE telegram_bot SET short_description = ? WHERE id = ?`, [

                    //
                    values.short_description,
                    this.#bot.id,
                ] );
                if ( !res.ok ) throw res;

                res = await this.#bot.telegramBotApi.setMyShortDescription( {
                    "short_description": values.short_description,
                } );
                if ( !res.ok ) throw res;
            } );

            if ( !res.ok ) return res;
        }

        // description
        if ( values.description != null && values.description !== this.#bot.description ) {
            res = await this.dbh.begin( async dbh => {
                res = await dbh.do( sql`UPDATE telegram_bot SET description = ? WHERE id = `, [

                    //
                    values.description,
                    this.#bot.id,
                ] );
                if ( !res.ok ) throw res;

                res = await this.#bot.telegramBotApi.setMyDescription( {
                    "description": values.description,
                } );
                if ( !res.ok ) throw res;
            } );

            if ( !res.ok ) return res;
        }

        return result( 200 );
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

    async getAdCampaignStats ( id, period ) {
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
            SQL.getBotAdCampaignStats,

            [

                // series
                period.step,
                id,
                start,

                // start
                id,
                start,

                // end
                id,
                this.#bot.id,
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
}
