import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";

const SQL = {
    "getByTelegramUserId": sql`
SELECT
    telegram_user.id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id,
    telegram_bot_user.user_id,
    telegram_bot_user.blocked,
    telegram_bot_user.banned,
    telegram_bot_user.state
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_user.telegram_id = ?
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;
    #dbh;
    #getUser;

    #cache;
    #telegramUserIdIndex = {};
    #telegramBotUserIdIndex = {};
    #apiUserId = {};

    constructor ( bot, getUser ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();
        this.#getUser = getUser;

        this.#dbh.on( "disconnect", () => this.#clear.bind( this ) );
    }

    // public
    async getByTelegramUserId ( telegramUserId ) {
        var user = this.#cache.get( telegramUserId );

        if ( !user ) {
            const res = await this.#dbh.selectRow( SQL.getByTelegramUserId, [telegramUserId] );

            if ( !res.ok ) return;

            user = new User( res.data );

            this.#cacheUser( user );
        }

        return user;
    }

    async getUser ( telegramUserId ) {
        var user = this.getCachedUserByTelegramUserId( telegramUserId );

        if ( !user ) {
            user = await this.#getUser( telegramUserId );
        }

        return user;
    }

    // private
    #cacheUser ( user ) {
        if ( !user ) return;
    }

    #clear () {
        this.#cache.clear( true );
    }
}
