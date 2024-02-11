import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";

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
    shutDown () {
        this.#dbhEvents.clear();
        this.dbh.maxListeners--;
    }

    async getTelegramBotUserByTelegramUserId ( telegramUserId, { dbh } = {} ) {
        var user = this.#cache.get( telegramUserId );

        user ??= await this.#getUser( "getByTelegramUserId", telegramUserId, dbh );

        return user;
    }

    async getTelegramBotUserById ( botUserId, { dbh } = {} ) {
        var user = this.#idIndex[ botUserId ];

        user ??= await this.#getUser( "getByTelegramBotUserId", botUserId, dbh );

        return user;
    }

    async getTelegramBotUserByApiUserId ( apiUserId, { dbh } = {} ) {
        var user = this.#apiUserIdIndex[ apiUserId ];

        user ??= await this.#getUser( "getByApiUserId", apiUserId, dbh );

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
            const res = await this.#bot.component.User.getByApiUserId( dbh || this.dbh, this.#bot, [ ...select ] );

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
        this.#idIndex = {};
        this.#apiUserIdIndex = {};
    }

    // private
    async #getUser ( method, id, dbh ) {
        const mutex = this.#getUserMutexes.get( method + "/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.#bot.component.User[ method ]( dbh || this.dbh, this.#bot, id );

        if ( res.data ) {
            var user = new this.#bot.component.User( this.#bot, res.data );

            this.#cacheUser( user );
        }

        mutex.unlock( user );

        return user;
    }

    #cacheUser ( user ) {
        if ( !user ) return;

        this.#cache.set( user.telegramUserId, user );

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
