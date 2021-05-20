import LRUCache from "lru-cache";

const DEFAULT_CACHE_SIZE = 10000;

export default class AuthCache {
    #api;
    #size;

    #cacheUser;
    #cacheToken;

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_SIZE;

        this.invalidateAll();
    }

    get ( token ) {
        if ( !this.#api.dbh.isConnected ) return;

        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isConnected ) return;

        this.#cacheToken.set( token.id, auth );

        if ( !this.#cacheUser[auth.userId] ) this.#cacheUser[auth.userId] = {};

        this.#cacheUser[auth.userId][token.id] = true;
    }

    // public
    invalidateUser ( userId ) {
        const tokens = this.#cacheUser[userId];

        if ( tokens ) {
            for ( const tokenId in tokens ) {
                this.#cacheToken.del( tokenId );
            }
        }
    }

    invalidateUserToken ( tokenId ) {
        this.#cacheToken.del( tokenId );
    }

    invalidateAll () {
        this.#cacheUser = {};

        this.#cacheToken = new LRUCache( {
            "max": this.#size,
            "noDisposeOnSet": true,
            "dispose": ( tokenId, auth ) => {
                if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
            },
        } );
    }
}
