import Component from "#lib/app/api/component";
import sql from "#lib/sql";
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
    ( SELECT hash FROM api_user_password_hash WHERE user_id = "user".id ) AS password_hash,
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
    ( SELECT hash FROM api_user_password_hash WHERE user_id = "user".id ) AS password_hash,
    ( SELECT get_api_user_notifications_profile( "user".id ) ) AS notifications
FROM
    "user"
WHERE
    email = ?
`.prepare(),

    "getUserTokenById": sql`
SELECT
    api_token.id,
    api_token.user_id,
    api_token.enabled,
    api_token_hash.fingerprint,
    api_token_hash.hash
FROM
    api_token,
    api_token_hash
WHERE
    api_token.id =  api_token_hash.api_token_id
    AND api_token.id = ?
`.prepare(),

    "getUserSessionById": sql`
SELECT
    api_session.id,
    api_session.user_id,
    api_session.last_authorized,
    api_session.hostname,
    api_session.remote_address,
    api_session.user_agent,
    api_session_hash.fingerprint,
    api_session_hash.hash
FROM
    api_session,
    api_session_hash
WHERE
    api_session.id =  api_session_hash.api_session_id
    AND api_session.id = ?
`.prepare(),
};

export default class extends Component {
    #mutexSet = new Mutex.Set();
    #userTokensCache;
    #userSessionsCache;

    // public

    getCachedUserTokenById ( tokenId ) {
        return this.#userTokensCache.get( tokenId );
    }

    async getUserTokenById ( tokenId, { dbh } = {} ) {
        var token = this.#userTokensCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `token/${tokenId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserTokenById, [tokenId] );

        if ( res.ok ) {
            token = this.#updateUserToken( res.data );
        }
        else {
            token = false;
        }

        mutex.unlock( token );

        return token;
    }

    getCachedUserSessionById ( tokenId ) {
        return this.#userSessionsCache.get( tokenId );
    }

    async getUserSessionById ( tokenId, { dbh } = {} ) {
        var token = this.#userSessionsCache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `session/${tokenId}` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getUserSessionById, [tokenId] );

        if ( res.ok ) {
            token = this.#updateUserSession( res.data );
        }
        else {
            token = false;
        }

        mutex.unlock( token );

        return token;
    }

    // protected
    async _init () {
        this.#userTokensCache = new CacheLru( { "maxSize": this.api.config.userTokensCacheMaxSize } );

        this.#userSessionsCache = new CacheLru( { "maxSize": this.api.config.userSessionsCacheMaxSize } );

        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "api/user-token/delete", this.#onUserTokenDelete.bind( this ) );
        this.dbh.on( "api/user-token/update", this.#onUserTokenUpdate.bind( this ) );

        this.dbh.on( "api/user-session/delete", this.#onUserSessionDelete.bind( this ) );
        this.dbh.on( "api/user-session/update", this.#onUserSessionUpdate.bind( this ) );

        return result( 200 );
    }

    // private
    #onBackendDisconnect () {
        this.#userTokensCache.clear( { "silent": true } );

        this.#userSessionsCache.clear( { "silent": true } );
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
