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

        // TODO
        // TODO validate email, if exists in fields
        async userCreate ( username, password, enabled, permissions, fields ) {

            // lowercase urename
            username = username.toLowerCase();

            // validate username
            let res = this.api.validateUsername( username );

            if ( !res.isOk() ) return res;

            // check user
            res = await this.dbh.selectRow( sql`SELECT "id" FROM "user" WHERE "name" = ?`, [username] );

            if ( !res.isOk() ) {
                return res;
            }

            // user already exists
            else if ( res.data ) {
                return result( [400, "User already exists"] );
            }

            // generate password, if password is empty
            if ( password == null || password === "" ) {
                password = crypto.randomBytes( 32 ).toString( "hex" );
            }
            else {

                // validate password
                res = this.api.validatePassword( password );

                if ( !res.isOk() ) return res;
            }

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
