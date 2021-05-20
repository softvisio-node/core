import AuthCache from "../auth/cache.js";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _init ( options ) {
            this.#authCache = new AuthCache( this, null );

            await this.dbh.on( "event/api/auth-cache/invalidate/user", userId => this.#authCache.invalidateUser( userId ) );
            await this.dbh.on( "event/api/auth-cache/invalidate/user-token", tokenId => this.#authCache.invalidateUserToken( tokenId ) );

            this.dbh.on( "disconnect", () => this.#authCache.invalidateAll() );

            if ( super._init ) return super._init( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
