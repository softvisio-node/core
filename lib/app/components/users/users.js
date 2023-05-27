import sql from "#lib/sql";
import User from "#lib/app/api/user";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "getUserById": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    gravatar,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_api_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    id = ?
`.prepare(),

    "getUserByEmail": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    gravatar,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_api_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),
};

export default class {
    #app;
    #config;
    #mutexSet = new Mutex.Set();
    #usersCache;
    #userEmailIndex = {};

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#usersCache = new CacheLru( { "maxSize": config.cacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#app.dbh;
    }

    // public
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "users/user/delete", this.#onUserDelete.bind( this ) );
        this.dbh.on( "users/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-notifications-profile/update", this.#onUserUpdate.bind( this ) );

        return result( 200 );
    }

    getCachedUserById ( userId ) {
        return this.#usersCache.get( userId );
    }

    async getUserById ( userId, { dbh } = {} ) {
        var user = this.#usersCache.get( userId );

        // user is cached
        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/id/${userId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserById, [userId] );

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.unlock( user );

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( userId ) return this.getUserById( userId );

        const mutex = this.#mutexSet.get( `user/email/${email}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserByEmail, [email] );

        var user;

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.unlock( user );

        return user;
    }

    // private
    #onBackendDisconnect () {
        this.#userEmailIndex = {};
        this.#usersCache.clear( { "silent": true } );
    }

    #onDeleteUserFromCache ( userId, user ) {
        delete this.#userEmailIndex[user.email];
    }

    #onUserDelete ( data ) {
        this.#usersCache.delete( data.id );
    }

    #onUserUpdate ( data ) {
        if ( !this.#usersCache.has( data.id ) ) return;

        this.#updateUser( data );
    }

    #updateUser ( data ) {
        if ( !data ) return;

        // get user from cache
        var user = this.#usersCache.get( data.id );

        // user is cached
        if ( user ) {
            if ( "email" in data ) {

                // user email was changed
                if ( user.email !== data.email ) {
                    delete this.#userEmailIndex[user.email];
                    this.#userEmailIndex[data.email] = user.id;
                }
            }

            user.update( data );
        }

        // user is not cached
        else {
            user = new User( this.api, data );

            this.#usersCache.set( user.id, user );

            this.#userEmailIndex[user.email] = user.id;
        }

        return user;
    }
}
