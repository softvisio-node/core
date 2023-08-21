import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const where = sql.where( options.where );

            const query = sql`
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
    telegram_bot
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
            const bot = this.app.telegram.getGot( botId );

            if ( !bot ) return result( 404 );

            return bot.api.getBot();
        }

        async API_getBotStats ( ctx, botId ) {}
    };
