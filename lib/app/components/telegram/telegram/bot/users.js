import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";

const SQL = {
    "getByTelegramId": sql`
SELECT
    telegram_user.id AS telegram_user_id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
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

    "getByTelegramBotUserId": sql`
SELECT
    telegram_user.id AS telegram_user_id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.blocked,
    telegram_bot_user.banned,
    telegram_bot_user.state
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_bot_user.id = ?
`.prepare(),

    "getByApiUserId": sql`
SELECT
    telegram_user.id AS telegram_user_id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.blocked,
    telegram_bot_user.banned,
    telegram_bot_user.state
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_bot_user.api_user_id = ?
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;
    #dbh;

    #cache; // telegramId
    #telegramUserIdIndex = {};
    #telegramBotUserIdIndex = {};
    #apiUserIdIndex = {};

    // XXX set dbh listeners
    constructor ( bot ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();

        this.#dbh.on( "disconnect", () => this.#clear.bind( this ) );
    }

    // public
    async getByTelegramId ( telegramId ) {
        var user = this.#cache.get( telegramId );

        user ??= await this.#getUser( "getByTelegramId", telegramId );

        return user;
    }

    async getByTelegramBotUserId ( telegramBotUserId ) {
        var user = this.#telegramBotUserIdIndex[telegramBotUserId];

        user ??= await this.#getUser( "getByTelegramBotUserId", telegramBotUserId );

        return user;
    }

    async getByApiUserId ( apiUserId ) {
        var user = this.#apiUserIdIndex[apiUserId];

        user ??= await this.#getUser( "getByApiUserId", apiUserId );

        return user;
    }

    // private
    async #getUser ( id, query ) {
        const res = await this.#dbh.selectRow( SQL[query], [this.#bot.id, id] );

        if ( !res.data ) return;

        const user = new User( res.data );

        this.#cacheUser( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.telegramId.user );
        this.#telegramUserIdIndex[user.telegramUserId] = user;
        this.#telegramBotUserIdIndex[user.telegramBotUserId] = user;
        this.#apiUserIdIndex[user.apiUserId] = user;
    }

    #clear () {
        this.#cache.clear( true );
        this.#telegramUserIdIndex = {};
        this.#telegramBotUserIdIndex = {};
        this.#apiUserIdIndex = {};
    }
}
