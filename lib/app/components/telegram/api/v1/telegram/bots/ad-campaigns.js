import sql from "#lib/sql";

export default Super =>
    class extends Super {
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
    };
