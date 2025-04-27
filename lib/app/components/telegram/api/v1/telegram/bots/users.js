import sql from "#lib/sql";

export default Super =>
    class extends Super {

        // public
        async [ "API_get-users-list" ] ( ctx, options ) {
            const where = sql.where( `telegram_user.id = telegram_bot_user.telegram_user_id` );

            if ( options.where?.search ) {
                const search = options.where.search;
                delete options.where.search;

                where.and(

                    //
                    { "username": search },
                    "OR",
                    { "first_name": search },
                    "OR",
                    { "last_name": search },
                    "OR",
                    { "phone": search },
                    "OR",
                    { "user.email": search }
                );
            }

            where.and( options.where );

            const query = sql`
SELECT
    telegram_bot_user.telegram_user_id AS id,
    telegram_bot_user.telegram_bot_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,
    telegram_bot_user.created,
    telegram_bot_user.last_activity,
    telegram_bot_user.subscribed,
    telegram_bot_user.returned,
    telegram_bot_user.enabled,
    ${ this.app.telegram.config.avatarUrl } || telegram_bot_user.telegram_bot_id || '/' || telegram_bot_user.telegram_user_id AS avatar_url,
    telegram_bot_user.api_user_id,
    "user".email AS api_user_email,
    CASE
        WHEN telegram_bot_user.api_user_id IS NOT NULL THEN ${ this.app.api.config.avatarUrl } || telegram_bot_user.api_user_id
        ELSE NULL
    END AS api_user_avatar_url
FROM
    telegram_user,
    telegram_bot_user
    LEFT JOIN "user" ON ( telegram_bot_user.api_user_id = "user".id )
`.WHERE( where );

            return this._read( ctx, query, { options } );
        }

        async [ "API_set-user-enabled" ] ( ctx, telegramBotId, telegramUserId, enabled ) {
            const bot = this.app.telegram.bots.getBotById( telegramBotId );
            if ( !bot ) return result( 404 );

            const user = await bot.users.getTelegramUserById( telegramUserId );
            if ( !user ) return result( 404 );

            return user.setEnabled( enabled );
        }
    };
