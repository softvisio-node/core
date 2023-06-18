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
    telegram_bot_user.subscribed,
    telegram_bot_user.disabled,
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
    telegram_bot_user.subscribed,
    telegram_bot_user.disabled,
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
    telegram_bot_user.subscribed,
    telegram_bot_user.disabled,
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
    #userIdIndex = {};
    #botUserIdIndex = {};
    #apiUserIdIndex = {};
    #getUserMutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();

        this.#dbh.on( "disconnect", () => this.clear.bind( this ) );

        this.#cache.on( "delete", ( telegramId, user ) => this.#deleteUser( user ) );

        this.#dbh.on( "telegram/telegram-user/update", data => {
            const user = this.#userIdIndex[data.id];

            user?.updateUserFields( data );
        } );

        this.#dbh.on( `telegram/telegram-bot-user/${this.#bot.id}/update`, data => {
            const user = this.#botUserIdIndex[data.id];

            user?.updateBotUserFields( data );
        } );
    }

    // public
    async getByTelegramId ( telegramId ) {
        var user = this.#cache.get( telegramId );

        user ??= await this.#getUser( "getByTelegramId", telegramId );

        return user;
    }

    async getByBotUserId ( botUserId ) {
        var user = this.#botUserIdIndex[botUserId];

        user ??= await this.#getUser( "getByBotUserId", botUserId );

        return user;
    }

    async getByApiUserId ( apiUserId ) {
        var user = this.#apiUserIdIndex[apiUserId];

        user ??= await this.#getUser( "getByApiUserId", apiUserId );

        return user;
    }

    clear () {
        this.#cache.clear( true );
        this.#userIdIndex = {};
        this.#botUserIdIndex = {};
        this.#apiUserIdIndex = {};
    }

    // private
    async #getUser ( query, id ) {
        const mutex = this.#getUserMutexes.get( query + "/" + id );

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

        this.#userIdIndex[user.userId] = user;
        this.#botUserIdIndex[user.botUserId] = user;

        if ( user.apiUserId ) this.#apiUserIdIndex[user.apiUserId] = user;

        user.on( "apiUserIdUpdate", this.#apiUserIdUpdate.bind( this ) );
    }

    #deleteUser ( user ) {
        delete this.#userIdIndex[user.userId];
        delete this.#botUserIdIndex[user.botUserId];

        if ( user.apiUserId ) delete this.#apiUserIdIndex[user.apiUserId];
    }

    #apiUserIdUpdate ( user, newApiUserId, oldApiUserId ) {
        if ( oldApiUserId ) delete this.#apiUserIdIndex[oldApiUserId];

        if ( newApiUserId ) this.#apiUserIdIndex[newApiUserId] = user;
    }
}
