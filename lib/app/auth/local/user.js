const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const crypto = require( "crypto" );
const { "v4": uuidv4 } = require( "uuid" );
const { ROOT_USER_ID } = require( "../../../const" );
const q = {
    "getUser": sql`SELECT "id", "guid", "name", "enabled" FROM "user" WHERE "id" = ? OR "name" = ? OR "guid" = ?`.prepare(),
    "removeUSer": sql`DELETE FROM "user" WHERE "id" = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET "enabled" = ? WHERE "id" = ? AND "enabled" = ?`.prepare(),
    "setUserPassword": sql`UPDATE "auth_hash" SET "hash" = ? WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {

        // TODO
        async userPasswordAuthenticate ( privateToken ) {
            return this._returnAuth( privateToken, privateToken.id, 1 );
        }

        // TODO convart permissions to object
        async userCreate ( userName, password, enabled, permissions, fields ) {

            // lowercase username
            userName = userName.toLowerCase();

            // validate username
            let res = this.validateUserName( userName );

            if ( !res.isOk() ) return res;

            // generate password, if password is empty
            if ( password == null || password === "" ) {
                password = crypto.randomBytes( 32 ).toString( "hex" );
            }

            // validate password
            else {
                res = this.validatePassword( password );

                if ( !res.isOk() ) return res;
            }

            if ( !fields ) fields = {};

            // validate email
            if ( fields.email != null ) {
                res = this.validateEmail( fields.email );

                if ( !res.isOk() ) return res;
            }

            // check user
            res = await this.getUser( userName );

            if ( res.isOk() ) return result( [409, "User already exists"] );

            // generate password hash
            const hash = await this._generatePasswordHash( userName, password );

            if ( !hash.isOk() ) return hash;

            // start transaction
            const user = await this.dbh.begin( async ( dbh ) => {

                // TODO convert permissions
                if ( !permissions ) permissions = {};

                // prepare fields
                fields = {
                    ...fields,
                    "name": userName,
                    "guid": uuidv4(),
                    "enabled": false,
                    "permissions": sql.JSON( permissions ),
                };

                let userId;

                if ( this.userIsRoot( userName ) ) userId = fields.id = ROOT_USER_ID;

                if ( dbh.isSqlite ) {
                    res = await dbh.do( sql`INSERT INTO "user"`.VALUES( [fields] ) );

                    userId = dbh.lastInsertRowId;
                }
                else {
                    res = await dbh.selectRow( sql`INSERT INTO "user"`.VALUES( [fields] ).sql`RETURNING "id"` );

                    if ( res.data ) userId = res.data.id;
                }

                if ( !res.isOk() ) throw res;

                // insert user hash
                res = await dbh.do( sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`, [fields.guid, hash.data] );

                // unable to insert user hash
                if ( !res.isOk() ) throw res;

                // enable user
                if ( enabled ) {
                    res = await dbh.do( q.setUserEnabled, [true, userId, false] );

                    if ( !res.isOk() ) throw res;
                }

                return result( 200, {
                    "id": userId,
                    "guid": fields.guid,
                    "name": userName,
                    password,
                    enabled,
                    permissions,
                } );
            } );

            return user;
        }

        // TODO fire event, invalidate-token, userName
        async userSetPassword ( userId, password ) {

            // validate password
            var res = this.validatePassword( password );

            if ( !res.isOk() ) return res;

            var user = await this.getUser( userId );

            if ( !user.isOk() ) return user;

            // generate password hash
            const hash = await this._generatePasswordHash( user.data.name, password );

            if ( !hash.isOk() ) return hash;

            res = await this.dbh.do( q.setUserPassword, [hash.data, user.data.guid] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( res.rows ) {

                // TODO event

                return res;
            }
            else {
                return result( 500 );
            }
        }

        // TODO fire event, invalidate user, userid
        async userSetEnabled ( userId, enabled ) {
            if ( this.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

            var user = await this.getUser( userId );

            if ( !user.isOk() ) return user;

            const res = await this.dbh.do( q.setUserEnabled, [enabled, user.data.id, !enabled] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( res.rows ) {

                // TODO fire events
                return res;
            }
            else {
                return result( 204 );
            }
        }

        // TODO fire invalidate event, invalidateuser, iserid
        async userRemove ( userId ) {
            if ( this.userIsRoot( userId ) ) return result( [400, "Unable to remove root user"] );

            var user = await this.getUser( userId );

            if ( !user.isOk() ) return user;

            const res = await this.dbh.do( q.removeUser, [user.data.id] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( res.rows ) {

                // TODO fire event

                return res;
            }
            else {
                return result( [404, "User not found"] );
            }
        }

        async getUser ( userId ) {
            var res = await this.dbh.selectRow( q.getUser, [userId, userId, userId] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( !res.data ) {
                return result( [404, "User not found"] );
            }
            else {
                return res;
            }
        }
    } );
