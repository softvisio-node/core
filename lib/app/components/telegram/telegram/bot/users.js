import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";

const SQL = {
    "getByTelegramId": sql`
SELECT
    telegram_user.id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.subscribed,
    telegram_bot_user.banned,
    telegram_bot_user.state,
    telegram_bot_user.locale
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
    telegram_user.id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.subscribed,
    telegram_bot_user.banned,
    telegram_bot_user.state,
    telegram_bot_user.locale
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
    telegram_user.id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.subscribed,
    telegram_bot_user.banned,
    telegram_bot_user.state,
    telegram_bot_user.locale
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_bot_user.api_user_id = ?
`.prepare(),

    "getUsersByApiUserId": sql`
SELECT
    telegram_user.id AS telegram_user_id,
    telegram_user.telegram_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id AS telegram_bot_user_id,
    telegram_bot_user.api_user_id,
    telegram_bot_user.subscribed,
    telegram_bot_user.banned,
    telegram_bot_user.state,
    telegram_bot_user.locale
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_bot_user.api_user_id IN ( SELECT json_array_elements_text( ? )::int8 )
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;

    #cache; // telegramId
    #userIdIndex = {};
    #botUserIdIndex = {};
    #apiUserIdIndex = {};
    #getUserMutexes = new Mutex.Set();
    #dbhEvents;
    #usersEvents;

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.usersCacheMaxSize } );

        this.#cache.on( "delete", ( telegramId, user ) => this.#deleteUser( user ) );

        this.dbh.maxListeners++;

        this.#dbhEvents = new Events()
            .link( this.dbh )
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-user/update", data => {
                const user = this.#userIdIndex[data.id];

                user?.updateUserFields( data );
            } )
            .on( `telegram/telegram-bot-user/${this.bot.id}/update`, data => {
                const user = this.#botUserIdIndex[data.id];

                user?.updateBotUserFields( data );
            } );

        this.app.users.maxListeners++;

        this.#usersEvents = new Events().link( this.app.users ).on( "userLocaleChange", apiUser => {
            const user = this.#apiUserIdIndex[apiUser.id];

            user?.setLocale( apiUser.locale );
        } );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.bot.app;
    }

    get dbh () {
        return this.bot.dbh;
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

    async getUsersByApiUserId ( users ) {
        var data = [],
            select;

        users = await this.app.users.getUsers( users );
        if ( !users ) return result( [500, `Unable to get users`] );

        // filter enabled users
        users = users.filter( user => user.isEnabled );

        for ( const apiUser of users ) {
            const user = this.#apiUserIdIndex[apiUser.id];

            if ( user ) {
                data.push( user );
            }
            else {
                select ??= {};

                select[apiUser.id] = apiUser;
            }
        }

        if ( select ) {
            const res = await this.dbh.select( SQL.getUsersByApiUserId, [this.bot.id, Object.keys( select )] );

            if ( !res.ok ) return;

            if ( res.data ) {
                for ( const row of res.data ) {
                    const user = new User( this.#bot, row );

                    data.push( user );
                }
            }
        }

        return data;
    }

    clear () {
        this.#cache.clear( { "silent": true } );
        this.#userIdIndex = {};
        this.#botUserIdIndex = {};
        this.#apiUserIdIndex = {};
    }

    destroy () {
        this.#dbhEvents.clear();
        this.dbh.maxListeners--;

        this.#usersEvents.clear();
        this.app.users.maxListeners--;
    }

    // private
    async #getUser ( query, id ) {
        const mutex = this.#getUserMutexes.get( query + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.dbh.selectRow( SQL[query], [this.bot.id, id] );

        if ( res.data ) {
            var user = new User( this.#bot, res.data );

            this.#cacheUser( user );
        }

        mutex.unlock( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.telegramId, user );

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
