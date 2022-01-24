import AuthCache from "../auth/cache.js";
import constants from "#lib/app/constants";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _new ( options ) {
            this.#authCache = new AuthCache( this, null );

            this.dbh.on( "api/user-enabled/update", data => {
                if ( !data.enabled ) this.#authCache.invalidateUser( data.user_id );
            } );

            this.dbh.on( "api/user-password/update", data => this.#authCache.invalidateUserToken( constants.tokenTypeUserCredentials + "/" + data.username ) );
            this.dbh.on( "api/user/delete", data => this.#authCache.invalidateUser( data.user_id ) );
            this.dbh.on( "api/user-name/update", data => this.#authCache.invalidateUser( data.user_id ) );
            this.dbh.on( "api/user-permissions/update", data => this.#authCache.invalidateUser( data.user_id ) );

            this.dbh.on( "api/invalidate-user-token", data => this.#authCache.invalidateUserToken( data.token_type + "/" + data.token_id ) );

            await this.dbh.waitConnect();

            this.dbh.on( "disconnect", () => this.#authCache.clear() );

            if ( super._new ) return super._new( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
