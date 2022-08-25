import AuthCache from "../auth/cache.js";
import constants from "#lib/app/constants";

export default Super =>
    class extends ( Super || Object ) {
        #authCache;

        async _init ( options ) {
            this.#authCache = new AuthCache( this );

            this.dbh.on( "api/user-enabled/update", data => {
                if ( !data.enabled ) this.#authCache.invalidateUser( data.user_id );
            } );

            this.dbh.on( "api/user-password/update", data => this.#authCache.invalidateUserToken( constants.tokenTypeUserCredentials + "/" + data.username ) );
            this.dbh.on( "api/user/delete", data => this.#authCache.invalidateUser( data.user_id ) );
            this.dbh.on( "api/user-name/update", data => this.#authCache.invalidateUser( data.user_id ) );
            this.dbh.on( "api/user-roles/update", data => this.#authCache.invalidateUser( data.user_id ) );

            this.dbh.on( "api/invalidate-user-key", data => this.#authCache.invalidateUserToken( data.token_type + "/" + data.token_id ) );

            await this.dbh.waitConnect();

            this.dbh.on( "disconnect", () => this.#authCache.clear() );

            if ( super._init ) return super._init( options );
            else return result( 200 );
        }

        get authCache () {
            return this.#authCache;
        }
    };
