import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_read ( ctx, options = {} ) {
            const query = sql`
SELECT
    *
FROM
    telegram_bot                    *
`;

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
    };
