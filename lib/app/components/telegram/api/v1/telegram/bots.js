import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const where = sql.where( options.where );

            const query = sql`
WITH bots AS (
    SELECT
        telegram_bot.*
    FROM
        telegram_bot,
        acl_user
    WHERE
        telegram_bot,acl_id = acl_user.acl_id
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

        async API_setBotStarted ( ctx, botId, started ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( [404, `Bot not found`] );

            return bot.setStarted( started );
        }

        async API_deleteBot ( ctx, botId ) {
            return this.app.telegram.deleteBot( botId );
        }

        async API_getBot ( ctx, botId ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( 404 );

            return bot.api.getBot( ctx.user.id );
        }

        async API_getBotStats ( ctx, botId, period ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( 404 );

            return bot.api.getBotStats( period );
        }

        async API_updateBotDetails ( ctx, botId, options ) {
            const bot = this.app.telegram.getBot( botId );

            if ( !bot ) return result( 404 );

            return bot.api.updateBotDetails( options );
        }
    };
