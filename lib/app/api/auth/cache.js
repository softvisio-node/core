import CacheLRU from "#core/cache-lru";

const DEFAULT_CACHE_MAX_SIZE = 10000;

export default class AuthCache {
    #api;
    #size;

    #userTokens = {};
    #cacheToken;

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_MAX_SIZE;
        this.#cacheToken = new CacheLRU( {
            "maxSize": this.#size,
        } ).on( "delete", ( tokenId, auth ) => {
            delete this.#userTokens[auth.userId]?.[tokenId];

            auth.remove();
        } );
    }

    get ( token ) {
        if ( !this.#api.dbh.isReady ) return;

        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isReady ) return;

        this.#cacheToken.set( token.id, auth );

        this.#userTokens[auth.userId] ||= {};

        this.#userTokens[auth.userId][token.id] = true;

        auth.cached();
    }

    // public
    invalidateUser ( userId ) {
        const tokens = this.#userTokens[userId];

        if ( tokens ) {
            for ( const tokenId in tokens ) {
                this.invalidateUserToken( tokenId );
            }
        }
    }

    invalidateUserToken ( tokenId ) {
        const auth = this.#cacheToken.get( tokenId );

        if ( auth ) {
            auth.invalidate();

            this.#cacheToken.delete( tokenId );
        }
    }

    reset () {
        this.#userTokens = {};

        this.#cacheToken.reset();
    }
}
