import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const SQL = {
    "getByTelegramUserId": sql`
SELECT
    *
FROM
    telegram_bot_user_view
WHERE
    telegram_user_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getByTelegramBotUserId": sql`
SELECT
    *
FROM
    telegram_bot_user_view
WHERE
    telegram_bot_user_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getByApiUserId": sql`
SELECT
    *
FROM
    telegram_bot_user_view
WHERE
    api_user_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getUsersByApiUserId": sql`
SELECT
    *
FROM
    telegram_bot_user_view
WHERE
    telegram_bot_id = ?
    AND api_user_id IN ( SELECT json_array_elements_text( ? )::int53 )
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;

    #cache; // telegramId
    #idIndex = {};
    #apiUserIdIndex = {};
    #getUserMutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.usersCacheMaxSize } );

        this.#cache.on( "delete", ( telegramId, user ) => this.#deleteUser( user ) );

        this.#bot.dbhEvents
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-user/update", data => {
                const user = this.#cache.get( data.id );

                user?.updateTelegramUserFields( data );
            } )
            .on( `telegram/telegram-bot-user/${ this.bot.id }/update`, data => {
                const user = this.#idIndex[ data.id ];

                user?.updateTelegramBotUserFields( data );
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
    async getTelegramBotUserByTelegramUserId ( telegramId, { dbh } = {} ) {
        var user = this.#cache.get( telegramId );

        user ??= await this.#getUser( "_getByTelegramUserId", telegramId, dbh );

        return user;
    }

    async getTelegramBotUserById ( botUserId, { dbh } = {} ) {
        var user = this.#idIndex[ botUserId ];

        user ??= await this.#getUser( "_getByTelegramBotUserId", botUserId, dbh );

        return user;
    }

    async getTelegramBotUserByApiUserId ( apiUserId, { dbh } = {} ) {
        var user = this.#apiUserIdIndex[ apiUserId ];

        user ??= await this.#getUser( "_getByApiUserId", apiUserId, dbh );

        return user;
    }

    // XXX init users ???
    async getUsersByApiUserId ( users, { dbh } = {} ) {
        var data = [],
            select = new Set();

        users = await this.app.users.getUsers( users );
        if ( !users ) return result( [ 500, `Unable to get users` ] );

        // filter enabled users
        users = users.filter( user => user.isEnabled );

        for ( const apiUser of users ) {
            const user = this.#apiUserIdIndex[ apiUser.id ];

            if ( user ) {
                data.push( user );
            }
            else {
                select.add( apiUser.id );
            }
        }

        if ( select.size ) {
            const res = await this._getByApiUserId( dbh || this.dbh, [ ...select ] );

            if ( !res.ok ) return;

            if ( res.data ) {
                for ( const row of res.data ) {
                    const user = new this.#bot.component.User( this.#bot, row );

                    // XXX
                    // const res1 = await user.init();
                    // if ( !res1.ok ) return;

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

    // protected
    async _getByTelegramUserId ( dbh, telegramId ) {
        return dbh.selectRow( SQL.getByTelegramUserId, [ telegramId, this.#bot.id ] );
    }

    async _getByTelegramBotUserId ( dbh, telegramBotUserId ) {
        return dbh.selectRow( SQL.getByTelegramBotUserId, [ telegramBotUserId, this.#bot.id ] );
    }

    async _getByApiUserId ( dbh, apiUserId ) {
        if ( Array.isArray( apiUserId ) ) {
            return dbh.select( SQL.getUsersByApiUserId, [ this.#bot.id, apiUserId ] );
        }
        else {
            return dbh.selectRow( SQL.getByApiUserId, [ apiUserId, this.#bot.id ] );
        }
    }

    // private
    async #getUser ( method, id, dbh ) {
        const mutex = this.#getUserMutexes.get( method + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this[ method ]( dbh || this.dbh, id );

        if ( res.data ) {
            var user = new this.#bot.component.User( this.#bot, res.data );

            const res1 = await user.init();
            if ( !res1.ok ) return;

            this.#cacheUser( user );
        }

        mutex.unlock( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.telegramId, user );

        this.#idIndex[ user.id ] = user;

        if ( user.apiUserId ) this.#apiUserIdIndex[ user.apiUserId ] = user;

        user.on( "apiUserIdUpdate", this.#apiUserIdUpdate.bind( this ) );
    }

    #deleteUser ( user ) {
        delete this.#idIndex[ user.id ];
        delete this.#apiUserIdIndex[ user.apiUserId ];
    }

    #apiUserIdUpdate ( user, newApiUserId, oldApiUserId ) {
        if ( oldApiUserId ) delete this.#apiUserIdIndex[ oldApiUserId ];

        if ( newApiUserId ) this.#apiUserIdIndex[ newApiUserId ] = user;
    }
}
