const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const crypto = require( "crypto" );
const { "v4": uuidv4 } = require( "uuid" );
const Lru = require( "lru-cache" );
const { ROOT_USER_ID } = require( "../../../const" );
const q = {
    "getUser": sql`SELECT "id", "guid", "name", "enabled" FROM "user" WHERE "id" = ? OR "name" = ? OR "guid" = ?`.prepare(),
    "removeUSer": sql`DELETE FROM "user" WHERE "id" = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET "enabled" = ? WHERE "id" = ? AND "enabled" = ?`.prepare(),
    "setUserPassword": sql`UPDATE "auth_hash" SET "hash" = ? WHERE "id" = ?`.prepare(),
    "authUser": sql`SELECT "user"."id", "user"."permissions", "auth_hash"."hash" FROM "user" LEFT JOIN "auth_hash" ON "user"."guid" = "auth_hash"."id" WHERE "user"."name" = ? AND "user"."enabled" = TRUE`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
            #app;
            #verifyPasswordHashCache = new Lru( {
                "max": 10000,
                "maxAge": 0,
            } );

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#app = app;
            }

            async authenticateUserPassword ( privateToken ) {
                var user = await this.dbh.selectRow( q.authUser, [privateToken.id] );

                // user not found or disabled
                if ( !user.data ) return;

                const valid = await this._verifyPasswordHash( user.data.hash, privateToken.hash );

                // password is invalid
                if ( !valid.isOk() ) return;

                return {
                    "id": user.data.id,
                    "name": privateToken.id,
                    "permissions": user.data.permissions,
                };
            }

            async createUser ( userName, password, enabled, permissions, fields ) {

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

            async setUserPassword ( userId, password ) {

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
                    this.invalidateUserToken( user.data.name );

                    return res;
                }
                else {
                    return result( 500 );
                }
            }

            async setUserEnabled ( userId, enabled ) {
                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

                var user = await this.getUser( userId );

                if ( !user.isOk() ) return user;

                const res = await this.dbh.do( q.setUserEnabled, [enabled, user.data.id, !enabled] );

                if ( !res.isOk() ) {
                    return res;
                }
                else if ( res.rows ) {
                    this.invalidateUser( user.data.name );

                    return res;
                }
                else {
                    return result( 204 );
                }
            }

            async removeUser ( userId ) {
                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to remove root user"] );

                var user = await this.getUser( userId );

                if ( !user.isOk() ) return user;

                const res = await this.dbh.do( q.removeUser, [user.data.id] );

                if ( !res.isOk() ) {
                    return res;
                }
                else if ( res.rows ) {
                    this.invalidateUser( user.data.name );

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

            async setUserPermissions ( userId, permissions ) {
                var user = await this.getUser( userId );

                if ( !user.isOk() ) return user;

                if ( !permissions ) permissions = {};

                var res = await this.dbh.do( sql`UPDATE "user" SET "permissions" = ? WHERE "id" = ?`, [sql.JSON( permissions ), user.data.id] );

                if ( !res.isOk() ) {
                    return res;
                }
                else {
                    this.invalidateUser( user.data.name );

                    return result( 200 );
                }
            }

            async updateUserPermissions ( userId, permissions ) {
                var user = await this.getUser( userId );

                if ( !user.isOk() ) return user;

                permissions = {
                    ...user.data.permissions,
                    ...( permissions || {} ),
                };

                var res = await this.dbh.do( sql`UPDATE "user" SET "permissions" = ? WHERE "id" = ?`, [sql.JSON( permissions ), user.data.id] );

                if ( !res.isOk() ) {
                    return res;
                }
                else {
                    this.invalidateUser( user.data.name );

                    return result( 200 );
                }
            }

            async _generatePasswordHash ( username, password ) {
                return this.#app.threads.call( "argon2", "hash", this.getHash( password + username ) );
            }

            async _verifyPasswordHash ( hash, passwordHash ) {
                var id = hash + "/" + passwordHash,
                    res = this.#verifyPasswordHashCache.get( id );

                if ( res ) return res;

                res = await this.#app.threads.call( "argon2", "verify", hash, passwordHash );

                this.#verifyPasswordHashCache.set( id, res );

                return res;
            }
    } );
