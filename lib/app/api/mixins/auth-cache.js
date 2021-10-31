import AuthCache from "../auth/cache.js";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _new ( options ) {
            this.#authCache = new AuthCache( this, null );

            this.dbh.on( "event/api/invalidate-user", data => this.#authCache.invalidateUser( data.id ) );
            this.dbh.on( "event/api/invalidate-user-token", data => this.#authCache.invalidateUserToken( data.token_type + "/" + data.token_id ) );
            await this.dbh.waitReady();

            this.dbh.on( "disconnect", () => this.#authCache.reset() );

            if ( super._new ) return super._new( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
