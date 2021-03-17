const redis = require( "../../../redis" );
const AuthCacheLocal = require( "./local" );

module.exports = class AuthCacheRedis extends AuthCacheLocal {
    #redis;

    constructor ( url ) {
        super( url );

        this.#redis = redis.connect( url );

        this.#redis.on( "end", super.invalidateAll.bind( this ) );

        this.#redis.on( "message_buffer", ( channel, id ) => {
            if ( channel === "auth-cache/invalidate-user" ) this.invalidateUser( id );
            else if ( channel === "auth-cache/invalidate-user-token" ) this.invalidateUserToken( id );
            else if ( channel === "auth-cache/invalidate-all" ) this.invalidateAll();
        } );

        this.#redis.subscribe( "auth-cache/invalidate-user", "auth-cache/invalidate-user-token", "auth-cache/invalidate-all" );
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
