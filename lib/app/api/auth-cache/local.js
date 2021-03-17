const LruCache = require( "lru-cache" );

module.exports = class AuthCacheLocal {
    #cacheUser = {};
    #cacheToken;

    get ( token ) {
        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        this.#cacheToken.set( token.id, auth );

        if ( !this.#cacheUser[auth.userId] ) this.#cacheUser[auth.userId] = {};

        this.#cacheUser[auth.userId][token.id] = true;
    }

    constructor ( url ) {
        this.#cacheToken = new LruCache( {
            "max": 10000,
            "noDisposeOnSet": true,
            "dispose": ( tokenId, auth ) => {
                if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
            },
        } );
    }

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

    // TODO currently is not effective, need noDispose on reset()
    invalidateAll () {
        this.#cacheToken.reset();

        // this.#cacheUser = {};
    }
};
