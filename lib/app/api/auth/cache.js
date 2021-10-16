import CacheLru from "#lib/cache-lru";

const DEFAULT_CACHE_MAX_SIZE = 10000;

export default class AuthCache {
    #api;
    #size;

    #userTokens = {};
    #cacheToken;

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_MAX_SIZE;
        this.#cacheToken = new CacheLru( {
            "maxSize": this.#size,
        } ).on( "delete", ( tokenCacheId, auth ) => {
            const userId = auth.userId,
                cache = this.#userTokens[userId];

            cache.delete( tokenCacheId );

            if ( !cache.size ) delete this.#userTokens[userId];

            auth.remove();
        } );
    }

    get ( token ) {
        if ( !this.#api.dbh.isReady ) return;

        return this.#cacheToken.get( token.cacheId );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isReady ) return;

        this.#cacheToken.set( token.cacheId, auth );

        this.#userTokens[auth.userId] ||= new Set();

        this.#userTokens[auth.userId].add( token.cacheId );

        auth.cached();
    }

    // public
    invalidateUser ( userId ) {
        const tokens = this.#userTokens[userId];

        if ( tokens ) {
            for ( const tokenCacheId of tokens ) {
                this.#invalidateToken( tokenCacheId );
            }
        }
    }

    invalidateUserToken ( tokenCacheId ) {
        this.#invalidateToken( tokenCacheId );
    }

    reset () {
        this.#userTokens = {};

        this.#cacheToken.reset();
    }

    // private
    #invalidateToken ( tokenCacheId ) {
        const auth = this.#cacheToken.delete( tokenCacheId );

        if ( auth ) auth.invalidate();
    }
}
