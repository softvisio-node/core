import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import sql from "#lib/sql";

const SQL = {
    "getById": sql`
SELECT
    row_to_json( telegram_user ) AS telegram_user,
    row_to_json( telegram_bot_user ) AS telegram_bot_user
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.telegram_bot_id = ?
    AND telegram_bot_user.telegram_user_id = ?
`.prepare(),

    "getByApiUserId": sql`
SELECT
    row_to_json( telegram_user ) AS telegram_user,
    row_to_json( telegram_bot_user ) AS telegram_bot_user
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.api_user_id = ?
    AND telegram_bot_user.telegram_bot_id = ?
`.prepare(),

    "getUsersByApiUserId": sql`
SELECT
    row_to_json( telegram_user ) AS telegram_user,
    row_to_json( telegram_bot_user ) AS telegram_bot_user
FROM
    telegram_user,
    telegram_bot_user
WHERE
    telegram_user.id = telegram_bot_user.telegram_user_id
    AND telegram_bot_user.api_user_id IN ( SELECT json_array_elements_text( ? )::int53 )
    AND telegram_bot_user.telegram_bot_id = ?
`.prepare(),
};

export default class TelegramBotUsers {
    #bot;
    #cache; // telegram id
    #apiUserIdIndex = {};
    #mutexes = new Mutex.Set();

    constructor ( bot ) {
        this.#bot = bot;

        this.#cache = new CacheLru( { "maxSize": this.bot.config.telegram.usersCacheMaxSize } );

        this.#cache.on( "delete", ( id, user ) => this.#deleteUser( user ) );

        this.#bot.dbhEvents
            .on( "disconnect", () => this.clear.bind( this ) )
            .on( "telegram/telegram-user/update", data => {
                const user = this.#cache.get( data.id );

                user?.updateTelegramUserFields( data );
            } )
            .on( `telegram/telegram-bot-user/${ this.bot.id }/update`, data => {
                const user = this.#cache.get( data.id );

                user?.updateTelegramBotUserFields( data );

                if ( "enabled" in data ) {
                    if ( data.enabled ) {
                        this.app.publish( `telegram-bot/${ this.bot.id }/user/${ data.id }/enable` );
                    }
                    else {
                        this.app.publish( `telegram-bot/${ this.bot.id }/user/${ data.id }/disable` );
                    }
                }
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
    async getById ( id, { dbh } = {} ) {
        var user = this.#cache.get( id );

        user ??= await this.#getUser( "_getById", id, dbh );

        return user;
    }

    async getByApiUserId ( apiUserId, { dbh } = {} ) {
        var user = this.#apiUserIdIndex[ apiUserId ];

        user ??= await this.#getUser( "_getByApiUserId", apiUserId, dbh );

        return user;
    }

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

                    data.push( user );
                }
            }
        }

        return data;
    }

    clear () {
        this.#cache.clear( { "silent": true } );
        this.#apiUserIdIndex = {};
    }

    // protected
    async _getById ( dbh, telegramUserId ) {
        return dbh.selectRow( SQL.getById, [ this.#bot.id, telegramUserId ] );
    }

    async _getByApiUserId ( dbh, apiUserId ) {
        if ( Array.isArray( apiUserId ) ) {
            return dbh.select( SQL.getUsersByApiUserId, [ apiUserId, this.#bot.id ] );
        }
        else {
            return dbh.selectRow( SQL.getByApiUserId, [ apiUserId, this.#bot.id ] );
        }
    }

    // private
    async #getUser ( method, id, dbh ) {
        const mutex = this.#mutexes.get( method + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this[ method ]( dbh || this.dbh, id );

        if ( res.data ) {
            var user = new this.#bot.component.User( this.#bot, res.data );

            this.#cacheUser( user );
        }

        mutex.unlock( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.id, user );

        if ( user.apiUserId ) this.#apiUserIdIndex[ user.apiUserId ] = user;

        user.on( "apiUserIdUpdate", this.#apiUserIdUpdate.bind( this ) );
    }

    #deleteUser ( user ) {
        delete this.#apiUserIdIndex[ user.apiUserId ];
    }

    #apiUserIdUpdate ( user, newApiUserId, oldApiUserId ) {
        if ( oldApiUserId ) delete this.#apiUserIdIndex[ oldApiUserId ];

        if ( newApiUserId ) this.#apiUserIdIndex[ newApiUserId ] = user;
    }
}
