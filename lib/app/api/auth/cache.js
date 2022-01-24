import CacheLru from "#lib/cache-lru";

const DEFAULT_CACHE_MAX_SIZE = 10000;

export default class AuthCache {
    #api;
    #size;

    #userTokens = {};
    #cacheToken;

    #userConnections = {};
    #connections = {};

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_MAX_SIZE;

        this.#cacheToken = new CacheLru( {
            "maxSize": this.#size,
        } );
    }

    get ( token ) {
        if ( !this.#api.dbh.isConnected ) return;

        return this.#cacheToken.get( token.cacheId );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isConnected ) return;

        this.#cacheToken.set( token.cacheId, auth );

        this.#userTokens[auth.userId] ||= new Set();
        this.#userTokens[auth.userId].add( token.cacheId );
    }

    connect ( connection ) {
        const auth = connection.auth,
            tokenCacheId = auth.token?.cacheId;

        if ( !tokenCacheId ) return;

        this.#connections[tokenCacheId] ||= new Set();
        this.#connections[tokenCacheId].add( connection );

        this.#userConnections[auth.userId] ||= new Set();
        this.#userConnections[auth.userId].add( connection );
    }

    disconnect ( connection ) {
        const auth = connection.auth,
            tokenCacheId = auth.token?.cacheId;

        if ( !tokenCacheId ) return;

        this.#connections[tokenCacheId].delete( connection );
        if ( !this.#connections[tokenCacheId].size ) delete this.#connections[tokenCacheId];

        this.#userConnections[auth.userId].delete( connection );
        if ( !this.#userConnections[auth.userId].size ) delete this.#userConnections[auth.userId];
    }

    // public
    invalidateUser ( userId ) {

        // invalidate user tokens
        const tokens = this.#userTokens[userId];
        if ( tokens ) {
            for ( const tokenCacheId of tokens ) {
                this.#deleteFromCache( tokenCacheId );
            }
        }

        // invalidate user connections
        const connections = this.#userConnections[userId];
        if ( connections ) {
            for ( const connection of connections ) {
                connection.disconnect( result( 4000 ) ); // signed out
            }
        }
    }

    invalidateUserToken ( tokenCacheId ) {
        this.#deleteFromCache( tokenCacheId );

        // invalidate connections by tokenCacheId
        const connections = this.#connections[tokenCacheId];
        if ( connections ) {
            for ( const connection of connections ) {
                connection.disconnect( result( 4000 ) ); // signed out
            }
        }
    }

    clear () {

        // clear auth cache
        this.#userTokens = {};
        this.#cacheToken.clear();

        // close connections
        for ( const connections of Object.values( this.#connections ) ) {
            for ( const connection of connections ) {
                connection.disconnect( result( 1006 ) ); // abnormal closure
            }
        }
    }

    // private
    #deleteFromCache ( tokenCacheId ) {
        const auth = this.#cacheToken.delete( tokenCacheId );

        if ( !auth ) return;

        const userId = auth.userId,
            userTokens = this.#userTokens[userId];

        userTokens.delete( tokenCacheId );
        if ( !userTokens.size ) delete this.#userTokens[userId];
    }
}
