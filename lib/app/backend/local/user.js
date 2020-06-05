const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const crypto = require( "crypto" );

module.exports = mixin( ( Super ) =>
    class extends Super {

        // TODO
        async userPasswordAuthenticate ( privateToken ) {
            return this._returnAuth( privateToken, privateToken.id, 1 );
        }

        validatePassword ( password ) {
            if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

            result( 200 );
        }

        // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
        validateUsername ( username ) {

            // check length
            if ( username.length < 3 || username.length > 32 ) return result( [400, "Username length must be between 3 and 32 characters"] );

            // contains forbidden chars
            if ( /[^a-z\d_@.-]/i.test( username ) ) return result( [400, `Username must contain letters, digits, "_", "@", ".", "-" characters only`] );

            // digits only
            if ( /^\d+$/.test( username ) ) return result( [400, "Username should not contain digits only"] );

            // looks like uuid
            if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( username ) ) return result( [400, "Username should not look like UUID"] );

            return result( 200 );
        }

        // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-32 characters
        validateTelegramUsername ( username ) {

            // check length
            if ( username.length < 5 || username.length > 32 ) return result( [400, "Telegram username length must be between 5 and 32 characters"] );

            // contains forbidden chars
            if ( /[^a-z\d_]/i.test( username ) ) return result( [400, `Telegram username must contain letters, digits and "_" only`] );

            return result( 200 );
        }

        validateEmail ( email ) {
            if ( /^[a-z\d][a-z\d._-]+[a-z\d]@[a-z\d.-]+$/i.test( email ) ) return result( [400, "Email is invalid"] );

            return result( 200 );
        }

        // TODO
        // TODO validate email, if exists in fields
        async userCreate ( username, password, enabled, permissions, fields ) {

            // lowercase urename
            username = username.toLowerCase();

            if ( !this.validateUsername( username ) ) return result( [400, "Username is not valid"] );

            // check user
            const res = await this.dbh.selectRow( sql`SELECT "id" FROM "user" WHERE "name" = ?`, [username] );

            if ( !res.isOk() ) {
                return res;
            }

            // user already exists
            else if ( res.data ) {
                return result( [400, "User already exists"] );
            }

            // generate password, if password is empty
            if ( password == null || password === "" ) password = crypto.randomBytes( 32 ).toString( "hex" );

            // generate password hash
            const hash = await this._generatePasswordHash( username, password );

            if ( !hash.isOk() ) return hash;

            // start transaction
            const user = await this.dbh.begin( async ( dbh ) => {

                // TODO convert permissions
                if ( !permissions ) permissions = {};

                if ( !fields ) fields = {};

                // insert user
                const user = await this._createUser( dbh, {
                    "name": username,
                    "enabled": false,
                    "permissions": sql.JSON( permissions ),
                    ...fields,
                } );

                if ( !user.isOk() ) throw res;

                // insert user hash
                let res = await dbh.do( sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`, [user.data.guid, hash.data] );

                if ( !res.isOk() ) throw res;

                // enable user
                if ( enabled ) {
                    res = await dbh.do( sql`UPDATE "user" SET "enabled" = TRUE WHERE "id" = ?`, [user.data.id] );

                    if ( !res.isOk() ) throw res;
                }

                user.data.password = password;

                return user;
            } );

            return user;
        }
    } );
