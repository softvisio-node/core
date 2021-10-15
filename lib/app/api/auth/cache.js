import CacheLru from "#lib/cache-lru";
import CONST from "#lib/const";

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

        const tokenCacheId = token.type + "/" + token.id;

        return this.#cacheToken.get( tokenCacheId );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isReady ) return;

        const tokenCacheId = token.type + "/" + token.id;

        this.#cacheToken.set( tokenCacheId, auth );

        this.#userTokens[auth.userId] ||= new Set();

        this.#userTokens[auth.userId].add( tokenCacheId );

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

    invalidateUserToken ( tokenId ) {
        const tokenCacheId = CONST.AUTH_TOKEN + "/" + tokenId;

        this.#invalidateToken( tokenCacheId );
    }

    invalidateUserSession ( tokenId ) {
        const tokenCacheId = CONST.AUTH_SESSION + "/" + tokenId;

        this.#invalidateToken( tokenCacheId );
    }

    reset () {
        this.#userTokens = {};

        this.#cacheToken.reset();
    }

    // private
    #invalidateToken ( tokenCacheId ) {
        const auth = this.#cacheToken.get( tokenCacheId );

        if ( auth ) {
            this.#cacheToken.delete( tokenCacheId );

            auth.invalidate();
        }
    }
}
