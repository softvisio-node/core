import sql from "#lib/sql";
import crypto from "crypto";
import constants from "#lib/app/constants";
import Auth from "../auth.js";

const QUERIES = {
    "getUserById": sql`SELECT id, name, enabled, locale, roles FROM "user" WHERE id = ?`.prepare(),
    "getUserByName": sql`SELECT id, name, enabled, locale, roles FROM "user" WHERE name = ?`.prepare(),
    "deleteUser": sql`DELETE FROM "user" WHERE id = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET enabled = ? WHERE id = ? AND enabled = ?`.prepare(),
    "setUserLocale": sql`UPDATE "user" SET locale = ? WHERE id = ?`.prepare(),
    "upsertHash": sql`INSERT INTO user_password_hash ( user_id, hash ) VALUES ( ?, ? ) ON CONFLICT ( user_id ) DO UPDATE SET hash = EXCLUDED.hash`.prepare(),
    "authUser": sql`
SELECT
    "user".id,
    "user".name,
    "user".locale,
    "user".roles,
    "user".gravatar,
    user_password_hash.hash
FROM
    "user"
    LEFT JOIN user_password_hash ON "user".id = user_password_hash.user_id
WHERE
    ( "user".name = ? OR "user".email = ? )
    AND "user".enabled = TRUE
`.prepare(),
    "updateRoles": sql`UPDATE "user" SET roles = ? WHERE id = ?`.prepare(),
    "setUserEmail": sql`UPDATE "user" SET email = ? WHERE id = ?`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {

        // public
        async authenticateUserCredentials ( username, password ) {
            const user = await this.dbh.selectRow( QUERIES.authUser, [username, username] );

            // user not found or disabled
            if ( !user.data ) return;

            const valid = await this.#verifyPasswordHash( password, user.data.hash );

            // password is invalid
            if ( !valid.ok ) return;

            return new Auth( this, null, {
                "userId": user.data.id,
                "username": user.data.name,
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

            // lowercase username
            email = email.toLowerCase();

            // validate email
            const emailIsValid = this.validateEmail( email );
            if ( !emailIsValid.ok ) return emailIsValid;

            // generate password, if password is empty
            if ( password == null || password === "" ) {
                password = this.#generatePassword();
            }

            // validate password
            else {
                const res = this.validatePassword( password );
                if ( !res.ok ) return res;
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
                fields.name = email;
                fields.email = email;
                fields.enabled = false;

                let res = await dbh.selectRow( sql`INSERT INTO "user"`.VALUES( fields ).sql`ON CONFLICT DO NOTHING RETURNING "id"` );

                if ( !res.ok ) {

                    // email is not unique
                    if ( res.meta.code === dbh.errors.UNIQUE_VIOLATION ) return result( [409, res.statusText] );

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

            // lowercase username
            email = email.toLowerCase();

            // validate user name
            const emailIsValid = this.validateEmail( email );
            if ( !res.ok ) return emailIsValid;

            dbh ||= this.dbh;

            // change user email
            const res = await dbh.do( QUERIES.setUserEmail, [email, userId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return res;
        }

        async setUserPassword ( userId, password, { dbh } = {} ) {
            dbh ||= this.dbh;

            // generate password, if password is empty
            if ( password == null || password === "" ) {
                password = this.#generatePassword();
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

            if ( this.userIsRoot( userId ) ) return result( [400, "Unable to remove root user"] );

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

            var res;

            // id
            if ( typeof userId === "bigint" || !isNaN( userId ) ) {
                res = await dbh.selectRow( QUERIES.getUserById, [userId] );
            }

            // username
            else {
                res = await dbh.selectRow( QUERIES.getUserByName, [userId] );
            }

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
        #generatePassword () {
            return crypto.randomBytes( 16 ).toString( "base64url" );
        }

        async #generatePasswordHash ( password ) {
            return this.app.threads.call( "argon2", "hash", password );
        }

        async #verifyPasswordHash ( password, hash ) {
            return this.app.threads.call( "argon2", "verify", hash, password );
        }
    };
