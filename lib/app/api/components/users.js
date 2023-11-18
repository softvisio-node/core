import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import constants from "#lib/app/constants";
import passwords from "#lib/passwords";
import fetch from "#lib/fetch";
import { validateEmail, validatePassword } from "#lib/validate";
import uuid from "#lib/uuis";

const SQL = {
    "deleteUser": sql`DELETE FROM "user" WHERE id = ?`.prepare(),

    "setUserEnabled": sql`UPDATE "user" SET enabled = ? WHERE id = ? AND enabled = ?`.prepare(),

    "setUserLocale": sql`UPDATE "user" SET locale = ? WHERE id = ?`.prepare(),

    "upsertHash": sql`INSERT INTO user_password_hash ( user_id, hash ) VALUES ( ?, ? ) ON CONFLICT ( user_id ) DO UPDATE SET hash = EXCLUDED.hash`.prepare(),

    "setUserEmail": sql`UPDATE "user" SET email = ?, email_confirmed = ? WHERE id = ? AND NOT EXISTS ( SELECT FROM "user" WHERE email = ? )`.prepare(),
};

export default class extends Component {

    // public
    validatePassword ( value ) {
        return validatePassword( value, { "strength": this.api.config.passwordsStrength } );
    }

    async authenticateUserPassword ( email, password, { dbh } = {} ) {
        if ( password == null || password === "" ) return;

        password = password + "";

        return this.#authenticateUser( email, { password, dbh } );
    }

    async authenticateUserOauth ( oauthProvider, oauthCode, oauthRedirectUri, { dbh } = {} ) {
        const res = await this.#oauth( oauthProvider, oauthCode, oauthRedirectUri );

        if ( !res.ok ) return;

        return this.#authenticateUser( res.data.email, { dbh } );
    }

    async createUser ( email, fields = {}, { dbh, root, roles, parentUserId } = {} ) {
        dbh ||= this.dbh;

        // make a copy
        fields = { ...fields };

        var password = fields.password;
        delete fields.password;

        // check email
        if ( email ) {

            // lowercase email
            email = email.toLowerCase();

            // validate email
            const emailIsValid = validateEmail( email );
            if ( !emailIsValid.ok ) return emailIsValid;
        }

        // generate fake email
        else {
            email = uuid + constants.fakeEmailDomain;
        }

        // generate password, if password is empty
        if ( !password ) {
            password = passwords.generatePassword().password;
        }

        // validate password
        else {
            const res = this.validatePassword( password );

            if ( !res.ok ) return res;
        }

        // validate locale
        if ( fields.locale ) {
            if ( !this.app.locales.has( fields.locale ) ) {
                delete fields.locale;
            }
        }

        // generate password hash
        const passwordHash = await this.app.argon2.createHash( password );

        // start transaction
        const user = await dbh.begin( async dbh => {
            if ( root ) {
                fields.id = constants.rootUserId;
                fields.enabled = true;
            }
            else {
                delete fields.id;
                fields.enabled ??= this.api.config.newUserEnabledByDefault;
            }

            const enabled = fields.enabled;

            // prepare fields
            fields.email = email;
            fields.enabled = false;

            let res = await dbh.selectRow( sql`INSERT INTO "user"`.VALUES( fields ).sql`ON CONFLICT DO NOTHING RETURNING id` );

            if ( !res.ok ) {

                // email is not unique
                // if ( res.meta.code === dbh.errors.UNIQUE_VIOLATION ) return result( [409, res.statusText] );

                // exception
                throw res;
            }

            // user already exists
            if ( !res.data ) return result( [409, "User already exists"] );

            const userId = res.data.id;

            // insert user password hash
            res = await dbh.do( SQL.upsertHash, [userId, passwordHash] );

            // unable to insert user hash
            if ( !res.ok ) throw res;

            // add user roles
            if ( !root && roles && roles.length ) {
                const res = await this.app.acl.addAclUser( constants.mainAclId, userId, { roles, parentUserId, dbh } );

                if ( !res.ok ) throw res;
            }

            // enable user
            if ( enabled ) {
                res = await dbh.do( SQL.setUserEnabled, [true, userId, false] );
                if ( !res.ok ) throw res;
            }

            return result( 200, {
                "id": userId,
                "name": email,
                email,
                password,
                enabled,
            } );
        } );

        return user;
    }

    async createUserOauth ( oauthProvider, oauthCode, oauthRedirectUri, fields = {}, options ) {
        const res = await this.#oauth( oauthProvider, oauthCode, oauthRedirectUri );

        if ( !res.ok ) return res;

        return this.createUser( res.data.email, fields, options );
    }

    async setUserEmail ( userId, email, { emailConfirmad = false, dbh } = {} ) {
        const user = await this.app.users.getUserById( userId, { dbh } );

        if ( !user ) return result( [404, `User not found`] );

        // lowercase email
        email = email.toLowerCase();

        // validate user name
        var res = validateEmail( email );
        if ( !res.ok ) return res;

        dbh ||= this.dbh;

        // change user email
        res = await dbh.do( SQL.setUserEmail, [email, emailConfirmad, userId, email] );

        if ( !res.ok ) return res;

        // unable to set email, user not found or email is not unique
        if ( !res.meta.rows ) return result( [400, `Email is already used`] );

        user.updateFields( { email } );

        return res;
    }

    async setUserPassword ( userId, password, { dbh } = {} ) {
        dbh ||= this.dbh;

        // generate password, if password is empty
        if ( !password ) {
            password = passwords.generatePassword().password;
        }

        // validate password
        else {
            const res = this.validatePassword( password );

            if ( !res.ok ) return res;
        }

        const user = await this.app.users.getUserById( userId, { dbh } );

        if ( !user ) return result( [404, `User not found`] );

        // generate password hash
        const passwordHash = await this.app.argon2.createHash( password );

        const res = await dbh.do( SQL.upsertHash, [user.id, passwordHash] );

        if ( !res.ok ) {
            return res;
        }
        else if ( res.meta.rows ) {
            return result( 200, { password } );
        }
        else {
            return result( [500, "Unable to update user authentication hash"] );
        }
    }

    async setUserEnabled ( userId, enabled, { dbh } = {} ) {
        dbh ||= this.dbh;

        if ( this.app.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

        const user = await this.app.users.getUserById( userId, { dbh } );

        if ( !user ) return result( [404, `User not found`] );

        const res = await dbh.do( SQL.setUserEnabled, [enabled, user.id, !enabled] );

        if ( !res.ok ) {
            return res;
        }
        else if ( res.meta.rows ) {
            user.updateFields( { "enabled": !!enabled } );

            return res;
        }
        else {
            return result( 204 );
        }
    }

    async setUserLocale ( userId, locale, { dbh } = {} ) {
        if ( !this.app.locales.has( locale ) ) return result( [400, `Locale is not valid`] );

        dbh ||= this.dbh;

        return dbh.do( SQL.setUserLocale, [locale, userId] );
    }

    async deleteUser ( userId, { dbh } = {} ) {
        dbh ||= this.dbh;

        if ( this.app.userIsRoot( userId ) ) return result( [400, "Unable to delete root user"] );

        const res = await dbh.do( SQL.deleteUser, [userId] );

        if ( !res.ok ) {
            return res;
        }
        else if ( res.meta.rows ) {
            return res;
        }
        else {
            return result( [404, "User not found"] );
        }
    }

    // private
    async #authenticateUser ( email, { password, dbh } = {} ) {
        const user = await this.app.users.getUserByEmail( email.toLowerCase(), { dbh } );

        // user not found or disabled
        if ( !user?.isEnabled ) return;

        if ( password && !( await user.verifyPassword( password ) ) ) return;

        return user;
    }

    async #oauth ( oauthProvider, oauthCode, oauthRedirectUri ) {
        var res;

        if ( oauthProvider === "google" ) {
            res = await this.#oauthGoogle( oauthCode, oauthRedirectUri );
        }
        else if ( oauthProvider === "github" ) {
            res = await this.#oauthGitHub( oauthCode, oauthRedirectUri );
        }
        else {
            res = result( [400, "Authorization provider is not supported"] );
        }

        if ( !res.ok ) return res;

        if ( !res.data.email ) return result( [500, `OAuth error`] );

        res.data.email = res.data.email.toLowerCase();

        return res;
    }

    async #oauthGoogle ( oauthCode, oauthRedirectUri ) {
        try {
            var res = await fetch( "https://oauth2.googleapis.com/token", {
                "method": "post",
                "headers": {
                    "content-type": "application/x-www-form-urlencoded",
                },
                "body": new URLSearchParams( {
                    "client_id": this.api.config.oauth.google.clientId,
                    "client_secret": this.api.config.oauth.google.clientSecret,
                    "redirect_uri": oauthRedirectUri,
                    "code": oauthCode,
                    "grant_type": "authorization_code",
                } ),
            } );
            if ( !res.ok ) return res;

            var data = await res.json();
            if ( !data?.access_token ) return result( [500, `OAuth error`] );

            res = await fetch( "https://www.googleapis.com/oauth2/v1/userinfo", {
                "headers": {
                    "authorization": "Bearer " + data.access_token,
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

    async #oauthGitHub ( oauthCode, oauthRedirectUri ) {
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
                    "redirect_uri": oauthRedirectUri,
                    "code": oauthCode,
                } ),
            } );
            if ( !res.ok ) return res;

            var data = await res.json();
            if ( !data?.access_token ) return result( [500, `OAuth error`] );

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
