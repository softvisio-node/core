import sql from "#lib/sql";

const SQL = {
    "getLink": sql`
SELECT
   id,
    name,
    description,
    created,
    'https://t.me/' || ( SELECT username FROM telegram_bot WHERE id = telegram_bot_id ) || ? || id AS link,
    last_user_created,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    total_returned_users,
    total_disabled_users
FROM
    telegram_bot_link
WHERE
    id = ?
`.prepare(),
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
    'https://t.me/' || ( SELECT username FROM telegram_bot WHERE id = telegram_bot_id ) || ${ "?start=" + this.app.telegram.config.linkStartParameterName + "-" } || id AS link,
    last_user_created,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    total_returned_users,
    total_disabled_users
FROM
    telegram_bot_link
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async API_getLink ( ctx, linkId ) {
            return this.dbh.selectRow( SQL.getLink, [ `?start=${ this.app.telegram.config.linkStartParameterName }-`, linkId ] );
        }

        async API_createLink ( ctx, botId, { name, description } ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.createLink( { name, description } );
        }

        async API_getLinkStats ( ctx, botId, linkId, period ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.getLinkStats( linkId, period );
        }

        async API_updateLink ( ctx, botId, linkId, fields ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.updateLink( linkId, fields );
        }

        async API_deleteLink ( ctx, botId, linkId ) {
            const bot = this.app.telegram.bots.getBotById( botId );

            if ( !bot ) return result( [ 500, `Bot not found` ] );

            return bot.links.deleteLink( linkId );
        }
    };
