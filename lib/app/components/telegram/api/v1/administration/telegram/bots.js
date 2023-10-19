import sql from "#lib/sql";

export default Super =>
    class extends Super {
        async API_getBotsList ( ctx, options = {} ) {
            const where = sql.where();

            if ( options.where?.name ) {
                where.and( { "name": options.where.name }, `OR`, { "telegram_username": options.where.name } );

                delete options.where.name;
            }

            where.and( options.where );

            const query = sql`
SELECT
    id,
    acl_id,
    type,
    static,
    name,
    telegram_username,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    started,
    error,
    error_text,
    ${this.app.telegram.config.avatarLocation + "/"} || id AS avatar_url
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
    };
