import AuthCache from "../auth/cache.js";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _new ( options ) {
            this.#authCache = new AuthCache( this, null );

            this.dbh.on( "event/api/invalidate-user", userId => this.#authCache.invalidateUser( userId ) );
            this.dbh.on( "event/api/invalidate-user-token", tokenCacheId => this.#authCache.invalidateUserToken( tokenCacheId ) );
            await this.dbh.waitReady();

            this.dbh.on( "disconnect", () => this.#authCache.reset() );

            if ( super._new ) return super._new( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
