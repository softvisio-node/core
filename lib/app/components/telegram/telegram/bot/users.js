import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";
import Mutex from "#lib/threads/mutex";

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

    "getByBotUserId": sql`
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
    #getUserMutexes = new Mutex.Set();

    // XXX set dbh listeners
    constructor ( bot ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();

        this.#dbh.on( "disconnect", () => this.#clear.bind( this ) );

        this.#cache.on( "delete", ( telegramId, user ) => {
            delete this.#telegramUserIdIndex[user.telegramUserId];
            delete this.#telegramBotUserIdIndex[user.telegramBotUserId];
            delete this.#apiUserIdIndex[user.apiUserId];
        } );
    }

    // public
    async getByTelegramId ( telegramId ) {
        var user = this.#cache.get( telegramId );

        user ??= await this.#getUser( "getByTelegramId", telegramId );

        return user;
    }

    async getByBotUserId ( telegramBotUserId ) {
        var user = this.#telegramBotUserIdIndex[telegramBotUserId];

        user ??= await this.#getUser( "getByBotUserId", telegramBotUserId );

        return user;
    }

    async getByApiUserId ( apiUserId ) {
        var user = this.#apiUserIdIndex[apiUserId];

        user ??= await this.#getUser( "getByApiUserId", apiUserId );

        return user;
    }

    // private
    async #getUser ( query, id ) {
        const mutex = this.#getUserMutexes( query + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.#dbh.selectRow( SQL[query], [this.#bot.id, id] );

        if ( res.data ) {
            var user = new User( res.data );

            this.#cacheUser( user );
        }

        mutex.unlock( user );

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
