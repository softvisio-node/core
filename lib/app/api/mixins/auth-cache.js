import AuthCache from "../auth/cache.js";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _init ( options ) {
            this.#authCache = new AuthCache( this, null );

            this.dbh.on( "event/api/invalidate-user", userId => this.#authCache.invalidateUser( userId ) );
            this.dbh.on( "event/api/invalidate-user-token", tokenId => this.#authCache.invalidateUserToken( tokenId ) );
            await this.dbh.waitConnect();

            this.dbh.on( "disconnect", () => this.#authCache.reset() );

            if ( super._init ) return super._init( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
