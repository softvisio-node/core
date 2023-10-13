import sql from "#lib/sql";
import User from "#lib/app/user";
import CacheLru from "#lib/cache/lru";
import Mutex from "#lib/threads/mutex";
import Events from "#lib/events";
import crypto from "node:crypto";

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
    get_user_notifications( "user".id ) AS notifications
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
    get_user_notifications( "user".id ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),

    "getUsersById": sql`
SELECT
    id,
    email,
    enabled,
    email_confirmed,
    locale,
    gravatar,
    ( SELECT hash FROM user_password_hash WHERE user_id = "user".id ) AS password_hash,
    get_user_notifications( "user".id ) AS notifications
FROM
    "user"
WHERE
    id IN ( SELECT json_array_elements_text( ? )::int8 )
`.prepare(),
};

export default class Users extends Events {
    #app;
    #config;
    #mutexSet = new Mutex.Set();
    #usersCache;
    #userEmailIndex = {};
    #defaultAvatarUrl;
    #defaultGravatarParam;

    constructor ( app, config ) {
        super();

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

    get defaultAvatarUrl () {
        return this.#defaultAvatarUrl;
    }

    get defaultGravatarParam () {
        return this.#defaultGravatarParam;
    }

    // public
    async configure () {
        var defaultGravatar;

        const defaultGravatarImage = this.config.defaultGravatarImage || "/storage/default-avatar";

        // gravatar email
        if ( defaultGravatarImage.includes( "@" ) ) {
            const emailHash = crypto.createHash( "MD5" ).update( defaultGravatarImage.toLowerCase() ).digest( "hex" );

            defaultGravatar = `https://s.gravatar.com/avatar/${emailHash}?d=404`;

            this.#defaultAvatarUrl = defaultGravatar;
        }

        // url
        else if ( defaultGravatarImage.includes( "/" ) ) {
            defaultGravatar = defaultGravatarImage;

            this.#defaultAvatarUrl = defaultGravatar;
        }

        // pre-defined param
        else {
            defaultGravatar = defaultGravatarImage;

            this.#defaultAvatarUrl = `https://s.gravatar.com/avatar?d=${defaultGravatar}`;
        }

        this.#defaultGravatarParam = encodeURIComponent( defaultGravatar );

        return result( 200 );
    }

    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "users/user/delete", this.#onUserDelete.bind( this ) );
        this.dbh.on( "users/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "users/user-notification/update", this.#onUserUpdate.bind( this ) );

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

    async getUsers ( users ) {
        const data = [],
            select = [];

        for ( const id of users ) {
            if ( id instanceof User ) {
                data.push( id );
            }
            else {
                const user = this.getCachedUserById( id );

                if ( user ) {
                    data.push( user );
                }
                else {
                    select.push( id );
                }
            }
        }

        if ( select.length ) {
            const res = await this.dbh.select( SQL.getUsersById, [select] );

            if ( !res.ok ) return;

            if ( res.data ) {
                for ( const row of res.data ) {
                    const user = new User( this.app, row );

                    data.push( user );
                }
            }
        }

        return data;
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

    #updateUser ( fields ) {
        if ( !fields ) return;

        // get user from cache
        var user = this.#usersCache.get( fields.id );

        // user is cached
        if ( user ) {
            if ( "email" in fields ) {

                // user email was changed
                if ( user.email !== fields.email ) {
                    delete this.#userEmailIndex[user.email];
                    this.#userEmailIndex[fields.email] = user.id;
                }
            }

            user.updateFields( fields );
        }

        // user is not cached
        else {
            user = new User( this.app, fields );

            user.on( "localeChange", () => this.emit( "userLocaleChange", user ) );

            this.#usersCache.set( user.id, user );

            this.#userEmailIndex[user.email] = user.id;
        }

        return user;
    }
}
