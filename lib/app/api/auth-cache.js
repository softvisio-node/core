const LruCache = require( "lru-cache" );

module.exports = class AuthCacheLocal {
    #app;
    #cacheSize;
    #cacheUser;
    #cacheToken;

    constructor ( app, cacheSize ) {
        this.#app = app;
        this.#cacheSize = cacheSize;

        this.#invalidateAll();

        app.on( "cluster/disconnect", this.#invalidateAll.bind( this ) );

        app.on( "api/auth-cache/invalidate/user", this.#invalidateUser.bind( this ) );
        app.on( "api/auth-cache/invalidate/user-token", this.#invalidateUserToken.bind( this ) );
    }

    get ( token ) {
        if ( this.#app.cluster.isBlocked ) return;

        return this.#cacheToken.get( token.id );
    }

    set ( token, auth ) {
        if ( this.#app.cluster.isBlocked ) return;

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
        this.#cacheUser = {};

        this.#cacheToken = new LruCache( {
            "max": this.#cacheSize,
            "noDisposeOnSet": true,
            "dispose": ( tokenId, auth ) => {
                if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
            },
        } );
    }
};
