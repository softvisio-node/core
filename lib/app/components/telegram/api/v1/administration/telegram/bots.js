import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // public
        async [ "API_get-bots-list" ] ( ctx, options = {} ) {
            const where = sql.where();

            if ( options.where?.name ) {
                where.and( { "name": options.where.name }, "OR", { "username": options.where.name } );

                delete options.where.name;
            }

            where.and( options.where );

            const query = sql`
SELECT
    id,
    type,
    static,
    deleted,
    name,
    username,
    total_users,
    total_subscribed_users,
    total_unsubscribed_users,
    started,
    error,
    error_text,
    ${ this.app.telegram.config.avatarUrl } || id AS avatar_url
FROM
    telegram_bot
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }
    };
