import sql from "#lib/sql";
import CacheLru from "#lib/cache/lru";
import Token from "#lib/app/token";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "getSessionById": sql`
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

export default class {
    #api;
    #mutexSet = new Mutex.Set();
    #cache;

    constructor ( api, maxSize ) {
        this.#api = api;

        this.#cache = new CacheLru( { maxSize } );
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.dbh;
    }

    // public
    async init () {
        this.dbh.on( "disconnect", this.#onBackendDisconnect.bind( this ) );

        this.dbh.on( "api/session/delete", this.#onSessionDelete.bind( this ) );
        this.dbh.on( "api/session/update", this.#onSessionUpdate.bind( this ) );

        return result( 200 );
    }

    getCachedSessionById ( tokenId ) {
        return this.#cache.get( tokenId );
    }

    async getSessionById ( tokenId, { dbh } = {} ) {
        var token = this.#cache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `session/${ tokenId }` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getSessionById, [ tokenId ] );

        if ( res.ok ) {
            token = this.#updateSession( res.data );
        }
        else {
            token = false;
        }

        mutex.unlock( token );

        return token;
    }

    // private
    #onBackendDisconnect () {
        this.#cache.clear( { "silent": true } );
    }

    #onSessionDelete ( data ) {
        this.#cache.delete( data.id );

        this.app.publush( `api-session/${ data.id }/delete` );
    }

    #onSessionUpdate ( data ) {
        if ( !this.#cache.has( data.id ) ) return;

        this.#updateSession( data );
    }

    #updateSession ( data ) {
        if ( !data ) return;

        // get token from cache
        var token = this.#cache.get( data.id );

        // token is cached
        if ( token ) {
            token.update( data );
        }

        // token is not cached
        else {
            data.type = constants.sessionToken.id;

            token = new Token( this.app, data );

            this.#cache.set( token.id, token );
        }

        return token;
    }
}
