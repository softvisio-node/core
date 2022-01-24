import CacheLru from "#lib/cache-lru";

const DEFAULT_CACHE_MAX_SIZE = 10000;
const LAST_USED_TROP_INTERVAL = 1000 * 60; // 1 minute

export default class AuthCache {
    #api;
    #size;

    #userAuthentications = {};
    #authentications;

    #userConnections = {};
    #connections = {};
    #lastUsedStats = new Map();

    constructor ( api, size ) {
        this.#api = api;
        this.#size = size || DEFAULT_CACHE_MAX_SIZE;

        this.#authentications = new CacheLru( {
            "maxSize": this.#size,
        } );

        setInterval( this.#dropLastUsedStats.bind( this ), LAST_USED_TROP_INTERVAL );
    }

    get ( token ) {
        if ( !this.#api.dbh.isConnected ) return;

        return this.#authentications.get( token.cacheId );
    }

    set ( token, auth ) {
        if ( !this.#api.dbh.isConnected ) return;

        this.#authentications.set( token.cacheId, auth );

        this.#userAuthentications[auth.userId] ||= new Set();
        this.#userAuthentications[auth.userId].add( token.cacheId );
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
        const tokens = this.#userAuthentications[userId];
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
        this.#userAuthentications = {};
        this.#authentications.clear();

        // close connections
        for ( const connections of Object.values( this.#connections ) ) {
            for ( const connection of connections ) {
                connection.disconnect( result( 1006 ) ); // abnormal closure
            }
        }
    }

    updateAuthLastUsed ( auth ) {
        if ( !auth.isAuthenticated || !auth.token.isUserSessionToken ) return;

        this.#lastUsedStats.set( auth.token.id, `UPDATE user_session SET last_used = '${new Date().toISOString()}' WHERE id = ${auth.token.id};` );
    }

    // private
    #deleteFromCache ( tokenCacheId ) {
        const auth = this.#authentications.delete( tokenCacheId );

        if ( !auth ) return;

        const userId = auth.userId,
            userTokens = this.#userAuthentications[userId];

        userTokens.delete( tokenCacheId );
        if ( !userTokens.size ) delete this.#userAuthentications[userId];
    }

    async #dropLastUsedStats () {
        if ( !this.#lastUsedStats.size ) return;

        const sql = [...this.#lastUsedStats.values()].join( " " );

        this.#api.dbh.exec( sql );

        this.#lastUsedStats.clear();
    }
}
