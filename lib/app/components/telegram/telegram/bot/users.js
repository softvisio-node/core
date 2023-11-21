import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";

const SQL = {
    "getByTelegramUserId": sql`
SELECT
    telegram_user.api_user_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id,
    telegram_bot_user.telegram_user_id,
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
    AND telegram_user.id = ?
`.prepare(),

    "getById": sql`
SELECT
    telegram_user.api_user_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id,
    telegram_bot_user.telegram_user_id,
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
    telegram_user.api_user_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id,
    telegram_bot_user.telegram_user_id,
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
    AND telegram_user.api_user_id = ?
`.prepare(),

    "getUsersByApiUserId": sql`
SELECT
    telegram_user.api_user_id,
    telegram_user.is_bot,
    telegram_user.username,
    telegram_user.first_name,
    telegram_user.last_name,
    telegram_user.phone,

    telegram_bot_user.id,
    telegram_bot_user.telegram_user_id,
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
    AND telegram_user.api_user_id IN ( SELECT json_array_elements_text( ? )::int8 )
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;

    #cache; // telegramUserId
    #idIndex = {};
    #apiUserIdIndex = {};
    #getUserMutexes = new Mutex.Set();
    #dbhEvents;

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.usersCacheMaxSize } );

        this.#cache.on( "delete", ( telegramUserId, user ) => this.#deleteUser( user ) );

        this.dbh.maxListeners++;

        this.#dbhEvents = new Events()
            .link( this.dbh )
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-user/update", data => {
                const user = this.#cache.get( data.id );

                user?.updateUserFields( data );
            } )
            .on( `telegram/telegram-bot-user/${this.bot.id}/update`, data => {
                const user = this.#idIndex[data.id];

                user?.updateBotUserFields( data );
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
    async getTelegramBotUserByTelegramUserId ( telegramUserId, { dbh } = {} ) {
        var user = this.#cache.get( telegramUserId );

        user ??= await this.#getUser( "getByTelegramUserId", telegramUserId, dbh );

        return user;
    }

    async getTelegramBotUserById ( botUserId, { dbh } = {} ) {
        var user = this.#idIndex[botUserId];

        user ??= await this.#getUser( "getById", botUserId, dbh );

        return user;
    }

    async getByApiUserId ( apiUserId, { dbh } = {} ) {
        var user = this.#apiUserIdIndex[apiUserId];

        user ??= await this.#getUser( "getByApiUserId", apiUserId, dbh );

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
        this.#idIndex = {};
        this.#apiUserIdIndex = {};
    }

    destroy () {
        this.#dbhEvents.clear();
        this.dbh.maxListeners--;
    }

    // private
    async #getUser ( query, id, dbh ) {
        const mutex = this.#getUserMutexes.get( query + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL[query], [this.bot.id, id] );

        if ( res.data ) {
            var user = new User( this.#bot, res.data );

            this.#cacheUser( user );
        }

        mutex.unlock( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.telegramUserId, user );

        this.#idIndex[user.id] = user;

        if ( user.apiUserId ) this.#apiUserIdIndex[user.apiUserId] = user;

        user.on( "apiUserIdUpdate", this.#apiUserIdUpdate.bind( this ) );
    }

    #deleteUser ( user ) {
        delete this.#idIndex[user.id];
        delete this.#apiUserIdIndex[user.apiUserId];
    }

    #apiUserIdUpdate ( user, newApiUserId, oldApiUserId ) {
        if ( oldApiUserId ) delete this.#apiUserIdIndex[oldApiUserId];

        if ( newApiUserId ) this.#apiUserIdIndex[newApiUserId] = user;
    }
}
