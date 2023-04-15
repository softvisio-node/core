import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import User from "#lib/app/api/user";
import CacheLru from "#lib/cache/lru";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";
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
    ( SELECT get_user_notifications_profile( "user".id ) ) AS notifications
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
    ( SELECT get_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),

    "getUserTokenById": sql`
SELECT
    user_token.id,
    user_token.user_id,
    user_token.enabled,
    user_token_hash.fingerprint,
    user_token_hash.hash
FROM
    user_token,
    user_token_hash
WHERE
    user_token.id =  user_token_hash.user_token_id
    AND user_token.id = ?
`.prepare(),

    "getUserSessionById": sql`
SELECT
    user_session.id,
    user_session.user_id,
    user_session.last_authorized,
    user_session.hostname,
    user_session.remote_address,
    user_session.user_agent,
    user_session_hash.fingerprint,
    user_session_hash.hash
FROM
    user_session,
    user_session_hash
WHERE
    user_session.id =  user_session_hash.user_session_id
    AND user_session.id = ?
`.prepare(),
};

export default class extends Component {
    #mutexSet = new Mutex.Set( { "destroyOnFinish": true } );
    #usersCache;
    #userEmailIndex = {};
    #userTokensCache;
    #userSessionsCache;

    // public
    getCachedUserById ( userId ) {
        return this.#usersCache.get( userId );
    }

    async getUserById ( userId, { dbh } = {} ) {
        var user = this.#usersCache.get( userId );

        // user is cached
        if ( user ) return user;

        const mutex = this.#mutexSet.get( `user/id/${userId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserById, [userId] );

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    async getUserByEmail ( email, { dbh } = {} ) {
        const userId = this.#userEmailIndex[email];

        if ( userId ) return this.getUserById( userId );

        const mutex = this.#mutexSet.get( `user/email/${email}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserByEmail, [email] );

        var user;

        if ( res.ok ) {
            user = this.#updateUser( res.data );
        }
        else {
            user = false;
        }

        mutex.signal.broadcast( user );
        mutex.up();

        return user;
    }

    getCachedUserTokenById ( tokenId ) {
        return this.#userTokensCache.get( tokenId );
    }

    async getUserTokenById ( tokenId, { dbh } = {} ) {
        var token = this.#userTokensCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `token/${tokenId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserTokenById, [tokenId] );

        if ( res.ok ) {
            token = this.#updateUserToken( res.data );
        }
        else {
            token = false;
        }

        mutex.signal.broadcast( token );
        mutex.up();

        return token;
    }

    getCachedUserSessionById ( tokenId ) {
        return this.#userSessionsCache.get( tokenId );
    }

    async getUserSessionById ( tokenId, { dbh } = {} ) {
        var token = this.#userSessionsCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `session/${tokenId}` );
        if ( !mutex.tryDown() ) return mutex.signal.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserSessionById, [tokenId] );

        if ( res.ok ) {
            token = this.#updateUserSession( res.data );
        }
        else {
            token = false;
        }

        mutex.signal.broadcast( token );
        mutex.up();

        return token;
    }

    // protected
    async _init () {
        this.#usersCache = new CacheLru( { "maxSize": this.api.config.usersCacheMaxSize } ).on( "delete", this.#onDeleteUserFromCache.bind( this ) );

        this.#userTokensCache = new CacheLru( { "maxSize": this.api.config.userTokensCacheMaxSize } );

        this.#userSessionsCache = new CacheLru( { "maxSize": this.api.config.userSessionsCacheMaxSize } );

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "api/user/delete", this.#onUserDelete.bind( this ) );
        this.dbh.on( "api/user/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-password-hash/update", this.#onUserUpdate.bind( this ) );
        this.dbh.on( "api/user-notifications/update", this.#onUserUpdate.bind( this ) );

        this.dbh.on( "api/user-token/delete", this.#onUserTokenDelete.bind( this ) );
        this.dbh.on( "api/user-token/update", this.#onUserTokenUpdate.bind( this ) );

        this.dbh.on( "api/user-session/delete", this.#onUserSessionDelete.bind( this ) );
        this.dbh.on( "api/user-session/update", this.#onUserSessionUpdate.bind( this ) );

        return result( 200 );
    }

    // private
    #onBackendDisconnect () {
        this.#userEmailIndex = {};
        this.#usersCache.clear( { "silent": true } );

        this.#userTokensCache.clear( { "silent": true } );

        this.#userSessionsCache.clear( { "silent": true } );
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

    #onUserTokenDelete ( data ) {
        this.#userTokensCache.delete( data.id );
    }

    #onUserTokenUpdate ( data ) {
        if ( !this.#userTokensCache.has( data.id ) ) return;

        this.#updateUserToken( data );
    }

    #updateUserToken ( data ) {
        if ( !data ) return;

        // get token from cache
        var token = this.#userTokensCache.get( data.id );

        // token is cached
        if ( token ) {
            token.update( data );
        }

        // token is not cached
        else {
            data.type = constants.tokenTypeUserToken;

            token = new Token( this.api, data );

            this.#userTokensCache.set( token.id, token );
        }

        return token;
    }

    #onUserSessionDelete ( data ) {
        this.#userSessionsCache.delete( data.id );
    }

    #onUserSessionUpdate ( data ) {
        if ( !this.#userSessionsCache.has( data.id ) ) return;

        this.#updateUserSession( data );
    }

    #updateUserSession ( data ) {
        if ( !data ) return;

        // get token from cache
        var token = this.#userSessionsCache.get( data.id );

        // token is cached
        if ( token ) {
            token.update( data );
        }

        // token is not cached
        else {
            data.type = constants.tokenTypeUserSession;

            token = new Token( this.api, data );

            this.#userSessionsCache.set( token.id, token );
        }

        return token;
    }
}
