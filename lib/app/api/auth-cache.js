const LruCache = require( "lru-cache" );

const CACHE_SIZE = 10000;

module.exports = class AuthCacheLocal {
    #cacheUser;
    #cacheToken;

    constructor ( app ) {
        app.on( "cluster/disconnect", this.#invalidateAll.bind( this ) );

        app.on( "api/auth/invalidate/user", this.#invalidateUser.bind( this ) );
        app.on( "api/auth/invalidate/user-token", this.#invalidateUserToken.bind( this ) );
        app.on( "api/auth/invalidate/all", this.#invalidateAll.bind( this ) );

        this.#createCache();
    }

    #createCache () {
        this.#cacheUser = {};

        this.#cacheToken = new LruCache( {
            "max": CACHE_SIZE,
            "noDisposeOnSet": true,
            "dispose": ( tokenId, auth ) => {
                if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
            },
        } );
    }

    get ( token ) {
        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        this.#cacheToken.set( token.id, auth );

        if ( !this.#cacheUser[auth.userId] ) this.#cacheUser[auth.userId] = {};

        this.#cacheUser[auth.userId][token.id] = true;
    }

    #invalidateUser ( userId ) {
        const tokens = this.#cacheUser[userId];

        if ( tokens ) {
            for ( const tokenId in tokens ) {
                this.#cacheToken.del( tokenId );
            }
        }
    }

    #invalidateUserToken ( tokenId ) {
        this.#cacheToken.del( tokenId );
    }

    #invalidateAll () {
        this.#createCache();
    }
};
