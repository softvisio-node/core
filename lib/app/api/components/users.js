import Component from "#lib/app/api/component";
import constants from "#lib/app/constants";
import fetch from "#lib/fetch";

export default class extends Component {

    // public
    async authenticateUserPassword ( email, password, { dbh } = {} ) {
        if ( password == null || password === "" ) return;

        password = password + "";

        return this.#authenticateUser( email, { password, dbh } );
    }

    async authenticateUserOauth ( oauthProvider, oauthCode, oauthRedirectUrl, { dbh } = {} ) {
        const res = await this.#oauth( oauthProvider, oauthCode, oauthRedirectUrl );

        if ( !res.ok ) return;

        return this.#authenticateUser( res.data.email, { dbh } );
    }

    async createUser ( email, { password, enabled, locale, root, roles, parentUserId, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.begin( async dbh => {
            const user = await this.app.users.createUser( email, {
                password,
                enabled,
                locale,
                root,
                dbh,
            } );

            if ( !user.ok ) return user;

            // add user roles
            if ( !root && roles?.length ) {
                const res = await this.app.acl.addAclUser( constants.mainAclId, user.data.id, { roles, parentUserId, dbh } );

                if ( !res.ok ) return res;
            }

            return user;
        } );
    }

    async createUserOauth ( oauthProvider, oauthCode, oauthRedirectUrl, { password, enabled, locale } = {}, options ) {
        const res = await this.#oauth( oauthProvider, oauthCode, oauthRedirectUrl );

        if ( !res.ok ) return res;

        return this.createUser( res.data.email, {
            password,
            enabled,
            locale,
        } );
    }

    // private
    async #authenticateUser ( email, { password, dbh } = {} ) {
        const user = await this.app.users.getUserByEmail( email.toLowerCase(), { dbh } );

        // user not found or disabled
        if ( !user?.isEnabled ) return;

        if ( password && !( await user.verifyPassword( password ) ) ) return;

        return user;
    }

    async #oauth ( oauthProvider, oauthCode, oauthRedirectUrl ) {
        var res;

        if ( oauthProvider === "google" ) {
            res = await this.#oauthGoogle( oauthCode, oauthRedirectUrl );
        }
        else if ( oauthProvider === "github" ) {
            res = await this.#oauthGitHub( oauthCode, oauthRedirectUrl );
        }
        else {
            res = result( [ 400, "Authorization provider is not supported" ] );
        }

        if ( !res.ok ) return res;

        if ( !res.data.email ) return result( [ 500, `OAuth error` ] );

        return res;
    }

    async #oauthGoogle ( oauthCode, oauthRedirectUrl ) {
        try {
            var res = await fetch( "https://oauth2.googleapis.com/token", {
                "method": "post",
                "headers": {
                    "content-type": "application/x-www-form-urlencoded",
                },
                "body": new URLSearchParams( {
                    "client_id": this.api.config.oauth.google.clientId,
                    "client_secret": this.api.config.oauth.google.clientSecret,
                    "redirect_uri": oauthRedirectUrl,
                    "code": oauthCode,
                    "grant_type": "authorization_code",
                } ),
            } );
            if ( !res.ok ) return res;

            var data = await res.json();
            if ( !data?.access_token ) return result( [ 500, `OAuth error` ] );

            res = await fetch( "https://www.googleapis.com/oauth2/v1/userinfo", {
                "headers": {
                    "authorization": "Bearer " + data.access_token,
                },
            } );

            if ( res.ok ) {
                data = await res.json();
            }
            else {
                return res;
            }

            return result( 200, data );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #oauthGitHub ( oauthCode, oauthRedirectUrl ) {
        try {
            var res = await fetch( "https://github.com/login/oauth/access_token", {
                "method": "post",
                "headers": {
                    "content-type": "application/x-www-form-urlencoded",
                    "accept": "application/json",
                },
                "body": new URLSearchParams( {
                    "client_id": this.api.config.oauth.github.clientId,
                    "client_secret": this.api.config.oauth.github.clientSecret,
                    "redirect_uri": oauthRedirectUrl,
                    "code": oauthCode,
                } ),
            } );
            if ( !res.ok ) return res;

            var data = await res.json();
            if ( !data?.access_token ) return result( [ 500, `OAuth error` ] );

            res = await fetch( "https://api.github.com/user", {
                "headers": {
                    "authorization": "Bearer " + data.access_token,
                    "accept": "application/json",
                },
            } );
            if ( !res.ok ) return res;

            data = await res.json();

            return result( 200, data );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }
}
