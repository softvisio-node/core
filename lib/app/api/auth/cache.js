import CacheLru from "#lib/cache/lru";

export default class AuthCache {
    #api;

    #authentications; // tokenCacheId : auth
    #userAuthentications = {}; // userId: [...tokenCacheId]

    #connections = {}; // tokenCacheId : [...connection]
    #userConnections = {}; // userId: [...connection]

    #userTokenLastActivity = new Map();
    #userSessionLastActivity = new Map();

    constructor ( api ) {
        this.#api = api;

        this.#authentications = new CacheLru( {
            "maxSize": this.#api.config.authCacheMaxSize,
        } ).on( "delete", this.#onAuthenticationDelete.bind( this ) );

        setInterval( this.#dropLastUsedStats.bind( this ), this.#api.config.authCacheLastActivityDropInterval );
    }

    get ( token ) {
        if ( !this.#api.dbh.isConnected ) return;

        return this.#authentications.get( token.cacheId );
    }

    add ( auth ) {
        if ( !this.#api.dbh.isConnected ) return;

        const token = auth.token;

        this.#authentications.set( token.cacheId, auth );

        this.#userAuthentications[auth.userId] ||= new Set();
        this.#userAuthentications[auth.userId].add( token.cacheId );
    }

    registerConnection ( connection ) {
        const auth = connection.auth,
            tokenCacheId = auth.token?.cacheId;

        if ( !tokenCacheId ) return;

        connection.once( "disconnect", this.#removeConnection.bind( this, connection ) );

        this.#connections[tokenCacheId] ||= new Set();
        this.#connections[tokenCacheId].add( connection );

        this.#userConnections[auth.userId] ||= new Set();
        this.#userConnections[auth.userId].add( connection );
    }

    // public
    updateUserLocale ( userId, locale ) {
        const tokens = this.#userAuthentications[userId];

        if ( !tokens ) return;

        for ( const tokenCacheId of tokens ) {
            this.#authentications.get( tokenCacheId, { "silent": true } ).setLocale( locale );
        }
    }

    invalidateUser ( userId ) {

        // invalidate user tokens
        const tokens = this.#userAuthentications[userId];
        if ( tokens ) {
            for ( const tokenCacheId of tokens ) {
                this.#authentications.delete( tokenCacheId );
            }
        }

        // close user connections
        const connections = this.#userConnections[userId];
        if ( connections ) {
            for ( const connection of connections ) {
                connection.end( 4000 ); // signed out
            }
        }
    }

    invalidateUserToken ( tokenCacheId ) {
        this.#authentications.delete( tokenCacheId );

        // close token connections
        const connections = this.#connections[tokenCacheId];
        if ( connections ) {
            for ( const connection of connections ) {
                connection.end( 4000 ); // signed out
            }
        }
    }

    clear () {

        // clear auth cache
        this.#userAuthentications = {};
        this.#authentications.clear( { "silent": true } );

        // close connections
        for ( const connections of Object.values( this.#connections ) ) {
            for ( const connection of connections ) {
                connection.end( 4503 ); // API backend is not available
            }
        }
    }

    updateAuthLastActivity ( auth ) {
        if ( !auth.isAuthenticated ) return;

        const lastActivity = new Date();

        if ( auth.token.isUserToken ) {
            this.#userTokenLastActivity.set( auth.token.id, `UPDATE user_token SET last_activity = '${lastActivity.toISOString()}' WHERE id = ${auth.token.id};` );
        }
        else if ( auth.token.isUserSessionToken ) {
            const expires = new Date( Date.now() + this.#api.config.sessionMaxAge );

            this.#userSessionLastActivity.set( auth.token.id, `UPDATE user_session SET last_activity = '${lastActivity.toISOString()}', expires = '${expires.toISOString()}' WHERE id = ${auth.token.id};` );
        }
    }

    // private
    #onAuthenticationDelete ( tokenCacheId, auth ) {
        const userId = auth.userId,
            userTokens = this.#userAuthentications[userId];

        if ( !userTokens ) return;

        userTokens.delete( tokenCacheId );

        if ( !userTokens.size ) delete this.#userAuthentications[userId];
    }

    #removeConnection ( connection ) {
        const auth = connection.auth,
            tokenCacheId = auth.token?.cacheId;

        if ( !tokenCacheId ) return;

        this.#connections[tokenCacheId].delete( connection );
        if ( !this.#connections[tokenCacheId].size ) delete this.#connections[tokenCacheId];

        this.#userConnections[auth.userId].delete( connection );
        if ( !this.#userConnections[auth.userId].size ) delete this.#userConnections[auth.userId];
    }

    async #dropLastUsedStats () {
        const sql = [];

        if ( this.#userTokenLastActivity.size ) {
            sql.push( ...this.#userTokenLastActivity.values() );
            this.#userTokenLastActivity.clear();
        }

        if ( this.#userSessionLastActivity.size ) {
            sql.push( ...this.#userSessionLastActivity.values() );
            this.#userSessionLastActivity.clear();
        }

        if ( !sql.length ) return;

        this.#api.dbh.exec( sql.join( " " ) );
    }
}
