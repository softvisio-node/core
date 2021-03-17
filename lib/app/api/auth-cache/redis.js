const redis = require( "../../../redis" );
const AuthCacheLocal = require( "./local" );

module.exports = class AuthCacheRedis extends AuthCacheLocal {
    #redis;

    constructor ( url ) {
        super( url );

        this.#redis = redis.connect( url );

        this.#redis.on( "error", e => console.log( "redis: " + e ) );

        this.#redis.on( "end", super.invalidateAll.bind( this ) );

        this.#redis.on( "pmessage", ( pattern, channel, id ) => {
            if ( channel === "auth-cache/invalidate-user" ) super.invalidateUser( id );
            else if ( channel === "auth-cache/invalidate-user-token" ) super.invalidateUserToken( id );
            else if ( channel === "auth-cache/invalidate-all" ) super.invalidateAll();
        } );

        this.#redis.psubscribe( "auth-cache/*" );
    }

    invalidateUser ( userId ) {
        super.invalidateUser( userId );

        this.#redis.publish( "auth-cache/invalidate-user", userId );
    }

    invalidateUserToken ( tokenId ) {
        super.invalidateUserToken( tokenId );

        this.#redis.publish( "auth-cache/invalidate-user-token", tokenId );
    }

    invalidateAll () {
        super.invalidateAll();

        this.#redis.publish( "auth-cache/invalidate-all" );
    }
};
