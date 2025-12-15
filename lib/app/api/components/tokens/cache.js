import constants from "#lib/app/constants";
import Token from "#lib/app/token";
import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "getTokenById": sql`
SELECT
    api_token.id,
    api_token.user_id,
    api_token.public,
    api_token.enabled,
    api_token_hash.hash
FROM
    api_token,
    api_token_hash
WHERE
    api_token.id =  api_token_hash.api_token_id
    AND api_token.id = ?
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

        this.dbh.on( "api/token/delete", this.#onTokenDelete.bind( this ) );
        this.dbh.on( "api/token/update", this.#onTokenUpdate.bind( this ) );

        return result( 200 );
    }

    getCachedTokenById ( tokenId ) {
        return this.#cache.get( tokenId );
    }

    async getTokenById ( tokenId, { dbh } = {} ) {
        var token = this.#cache.get( tokenId );

        if ( token ) return token;

        const mutex = this.#mutexSet.get( `token/${ tokenId }` );
        if ( !mutex.tryLock() ) return mutex.wait();

        dbh ||= this.dbh;

        const res = await dbh.selectRow( SQL.getTokenById, [ tokenId ] );

        if ( res.ok ) {
            token = this.#updateToken( res.data );
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

    #onTokenDelete ( data ) {
        this.#cache.delete( data.id );

        this.app.publish( `api-token/${ data.id }/delete` );
    }

    #onTokenUpdate ( data ) {
        if ( !this.#cache.has( data.id ) ) return;

        this.#updateToken( data );

        if ( "enabled" in data ) {
            if ( data.enabled === true ) {
                this.app.publish( `api-token/${ data.id }/enable` );
            }
            else if ( data.enabled === false ) {
                this.app.publish( `api-token/${ data.id }/disable` );
            }
        }
    }

    #updateToken ( data ) {
        if ( !data ) return;

        // get token from cache
        var token = this.#cache.get( data.id );

        // token is cached
        if ( token ) {
            token.update( data );
        }

        // token is not cached
        else {
            data.type = constants.apiToken.id;

            token = new Token( this.app, data );

            this.#cache.set( token.id, token );
        }

        return token;
    }
}
