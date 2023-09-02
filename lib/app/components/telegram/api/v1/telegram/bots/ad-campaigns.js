import sql from "#lib/sql";
import uuid from "#lib/uuid";

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

    "delete": sql`DELETE FROM telegram_bot_ad_campaign WHERE id = ? AND telegram_bot_id = ?`.prepare(),
};

export default Super =>
    class extends Super {

        // XXX
        async API_read ( ctx, options = {} ) {
            const where = sql.where( options.where );

            const query = sql`
SELECT
    *,
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
    telegram_bot
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
        async API_getAdCampaignStats ( ctx, botId, adCampaignId, period ) {}

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
