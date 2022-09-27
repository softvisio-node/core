import sql from "#lib/sql";
import constants from "#lib/app/constants";
import Auth from "../auth.js";
import passwords from "#lib/utils/passwords";
import fetch from "#lib/fetch";

const QUERIES = {
    "getUserById": sql`SELECT id, email, enabled, locale, roles FROM "user" WHERE id = ?`.prepare(),
    "deleteUser": sql`DELETE FROM "user" WHERE id = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET enabled = ? WHERE id = ? AND enabled = ?`.prepare(),
    "setUserLocale": sql`UPDATE "user" SET locale = ? WHERE id = ?`.prepare(),
    "upsertHash": sql`INSERT INTO user_password_hash ( user_id, hash ) VALUES ( ?, ? ) ON CONFLICT ( user_id ) DO UPDATE SET hash = EXCLUDED.hash`.prepare(),
    "authUser": sql`
SELECT
    "user".id,
    "user".email,
    "user".locale,
    "user".roles,
    "user".gravatar,
    user_password_hash.hash
FROM
    "user"
    LEFT JOIN user_password_hash ON "user".id = user_password_hash.user_id
WHERE
    "user".email = ?
    AND "user".enabled = TRUE
`.prepare(),

    "updateRoles": sql`UPDATE "user" SET roles = ? WHERE id = ?`.prepare(),

    "setUserEmail": sql`UPDATE "user" SET email = ?, email_confirmed = TRUE WHERE id = ? AND NOT EXISTS ( SELECT FROM "user" WHERE email = ? )`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {

        // public
        async authenticateUserCredentials ( email, password ) {
            const user = await this.dbh.selectRow( QUERIES.authUser, [email] );

            // user not found or disabled
            if ( !user.data ) return;

            const valid = await this.#verifyPasswordHash( password, user.data.hash );

            // password is invalid
            if ( !valid.ok ) return;

            return new Auth( this, null, {
                "userId": user.data.id,
                "email": user.data.email,
                "locale": user.data.locale,
                "roles": this._buildUserRoles( user.data.id, user.data.roles ),
                "gravatar": user.data.gravatar,
            } );
        }

        async authenticateUserOauth ( oauthProvider, oauthCode ) {
            var res;

            if ( oauthProvider === "google" ) {
                res = await this.#oauthGoogle( oauthCode );
            }
            else if ( oauthProvider === "github" ) {
                res = await this.#oauthGitHub( oauthCode );
            }
            else {
                res = result( [400, "Authorization provider is not supported"] );
            }

            if ( !res.ok ) return;

            const user = await this.dbh.selectRow( QUERIES.authUser, [res.data.email] );
            if ( !user.data ) return;

            return new Auth( this, null, {
                "userId": user.data.id,
                "email": user.data.email,
                "locale": user.data.locale,
                "roles": this._buildUserRoles( user.data.id, user.data.roles ),
                "gravatar": user.data.gravatar,
            } );
        }

        async createUser ( email, fields = {}, { dbh, root } = {} ) {
            dbh ||= this.dbh;

            // make a copy
            fields = { ...fields };

            var password = fields.password;
            delete fields.password;

            // lowercase email
            email = email.toLowerCase();

            // validate email
            const emailIsValid = this.validateEmail( email );
            if ( !emailIsValid.ok ) return emailIsValid;

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
                if ( !this.app.config.locales.has( fields.locale ) ) {
                    delete fields.locale;
                }
            }

            // validate telegram name
            if ( fields.telegram_username != null ) {
                fields["telegram_username"] = fields.telegram_username.toLowerCase();

                const res = this.validateTelegramUsername( fields.telegram_username );
                if ( !res.ok ) return res;
            }

            // validate roles
            if ( root || !fields.roles ) {
                fields.roles = {};
            }
            else {
                const res = this.validateUserRoles( Object.keys( fields.roles ) );
                if ( !res.ok ) return res;
            }

            // generate password hash
            const hash = await this.#generatePasswordHash( password );
            if ( !hash.ok ) return hash;

            // start transaction
            const user = await dbh.begin( async dbh => {
                if ( root ) {
                    fields.id = constants.rootUserId;
                    fields.enabled = true;
                }
                else {
                    delete fields.id;
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

                // insert user hash
                res = await dbh.do( QUERIES.upsertHash, [userId, hash.data] );

                // unable to insert user hash
                if ( !res.ok ) throw res;

                // enable user
                if ( enabled ) {
                    res = await dbh.do( QUERIES.setUserEnabled, [true, userId, false] );
                    if ( !res.ok ) throw res;
                }

                return result( 200, {
                    "id": userId,
                    "name": email,
                    email,
                    password,
                    enabled,
                    "roles": fields.roles,
                } );
            } );

            return user;
        }

        async setUserEmail ( userId, email, { dbh } = {} ) {

            // lowercase email
            email = email.toLowerCase();

            // validate user name
            var res = this.validateEmail( email );
            if ( !res.ok ) return res;

            dbh ||= this.dbh;

            // change user email
            res = await dbh.do( QUERIES.setUserEmail, [email, userId, email] );

            if ( !res.ok ) return res;

            // unable to set email, user not found or email is not unique
            if ( !res.meta.rows ) return result( [400, `Email is already used`] );

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

            var user = await this._getUser( userId, { dbh } );

            if ( !user.ok ) return user;

            // generate password hash
            const hash = await this.#generatePasswordHash( password );

            if ( !hash.ok ) return hash;

            const res = await dbh.do( QUERIES.upsertHash, [user.data.id, hash.data] );

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

            if ( this.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

            var user = await this._getUser( userId, { dbh } );

            if ( !user.ok ) return user;

            const res = await dbh.do( QUERIES.setUserEnabled, [enabled, user.data.id, !enabled] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                return res;
            }
            else {
                return result( 204 );
            }
        }

        async setUserLocale ( userId, locale, { dbh } = {} ) {
            if ( !this.app.config.locales.has( locale ) ) return result( [400, `Locale is not valid`] );

            dbh ||= this.dbh;

            const res = await dbh.do( QUERIES.setUserLocale, [locale, userId] );

            return res;
        }

        async deleteUser ( userId, { dbh } = {} ) {
            dbh ||= this.dbh;

            if ( this.userIsRoot( userId ) ) return result( [400, "Unable to delete root user"] );

            const res = await dbh.do( QUERIES.deleteUser, [userId] );

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

        async setUserRoles ( userId, roles, { dbh } = {} ) {
            dbh ||= this.dbh;

            // validate roles
            var res = this.validateUserRoles( Object.keys( roles ) );

            // roles are invalid
            if ( !res.ok ) return res;

            res = await dbh.do( QUERIES.updateRoles, [roles, userId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( !res.meta.rows ) {
                return result( [404, "User not found"] );
            }
            else {
                return result( 200 );
            }
        }

        async updateUserRoles ( userId, roles, { dbh } = {} ) {
            dbh ||= this.dbh;

            // validate roles
            var res = this.validateUserRoles( Object.keys( roles ) );

            // roles are invalid
            if ( !res.ok ) return res;

            var user = await this._getUser( userId, { dbh } );

            if ( !user.ok ) return user;

            // merge user roles
            roles = {
                ...user.data.roles,
                ...roles,
            };

            res = await dbh.do( QUERIES.updateRoles, [roles, user.data.id] );

            if ( !res.ok ) {
                return res;
            }
            else {
                return result( 200 );
            }
        }

        // protected
        async _getUser ( userId, { dbh } = {} ) {
            dbh ||= this.dbh;

            const res = await dbh.selectRow( QUERIES.getUserById, [userId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( !res.data ) {
                return result( [404, "User not found"] );
            }
            else {
                res.data.roles = this._buildUserRoles( userId, res.data.roles );

                return res;
            }
        }

        // private
        async #generatePasswordHash ( password ) {
            return this.app.threads.call( "argon2", "hash", password );
        }

        async #verifyPasswordHash ( password, hash ) {
            return this.app.threads.call( "argon2", "verify", hash, password );
        }

        async #oauthGoogle ( code ) {
            try {
                var res = await fetch( "https://oauth2.googleapis.com/token", {
                    "method": "post",
                    "headers": {
                        "content-type": "application/x-www-form-urlencoded",
                    },
                    "body": new URLSearchParams( {
                        "client_id": this.app.env.api.oauth.google.clientId,
                        "client_secret": this.app.env.api.oauth.google.clientSecret,
                        "redirect_uri": "http://localhost/api/oauth.html",
                        "grant_type": "authorization_code",
                        "code": code,
                    } ),
                } );
                if ( !res.ok ) return res;

                var data = await res.json();
                if ( !data?.access_token ) return result( [500, `OAuth error`] );

                res = await fetch( "https://www.googleapis.com/oauth2/v1/userinfo", {
                    "headers": {
                        "Authorization": "Bearer " + data.access_token,
                    },
                } );
                if ( !res.ok ) return res;

                data = await res.json();
                if ( !data.email ) return result( [500, `OAuth error`] );

                return result( 200, data );
            }
            catch ( e ) {
                return result.cath( e );
            }
        }

        async #oauthGitHub ( code ) {}
    };
