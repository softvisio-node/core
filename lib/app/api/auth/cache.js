import LRUCache from "lru-cache";

const DEFAULT_CACHE_SIZE = 10000;

export default class AuthCache {
    #api;
    #size;

    #userTokens = {};
    #cacheToken;

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_SIZE;
        this.#cacheToken = new LRUCache( {
            "max": this.#size,
            "noDisposeOnSet": true,
            "dispose": ( tokenId, auth ) => {
                delete this.#userTokens?.[auth.userId]?.[tokenId];

                auth.invalidate();
            },
        } );
    }

    get ( token ) {
        if ( !this.#api.dbh.isConnected ) return;

        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isConnected ) return;

        this.#cacheToken.set( token.id, auth );

        this.#userTokens[auth.userId] ||= {};

        this.#userTokens[auth.userId][token.id] = true;
    }

    // public
    invalidateUser ( userId ) {
        const tokens = this.#userTokens[userId];

        if ( tokens ) {
            delete this.#userTokens[userId];

            for ( const tokenId in tokens ) {
                this.#cacheToken.del( tokenId );
            }
        }
    }

    invalidateUserToken ( tokenId ) {
        this.#cacheToken.del( tokenId );
    }

    invalidateAll () {
        this.#userTokens = {};

        this.#cacheToken.reset();
    }
}
