const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const crypto = require( "crypto" );
const { "v4": uuidv4 } = require( "uuid" );
const Lru = require( "lru-cache" );
const { ROOT_USER_ID } = require( "../../../const" );
const q = {
    "getUser": sql`SELECT "id", "guid", "name", "enabled", "permissions" FROM "user" WHERE "id" = ?`.prepare(),
    "removeUser": sql`DELETE FROM "user" WHERE "id" = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET "enabled" = ? WHERE "id" = ? AND "enabled" = ?`.prepare(),
    "insertHash": sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "updateHash": sql`UPDATE "auth_hash" SET "hash" = ? WHERE "id" = ?`.prepare(),
    "authUser": sql`SELECT "user"."id", "user"."permissions", "auth_hash"."hash" FROM "user" LEFT JOIN "auth_hash" ON "user"."guid" = "auth_hash"."id" WHERE "user"."name" = ? AND "user"."enabled" = TRUE`.prepare(),
    "updatePermissions": sql`UPDATE "user" SET "permissions" = ? WHERE "id" = ?`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #app;
            #dbh;
            #verifyPasswordHashCache = new Lru( {
                "max": 10000,
            } );

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#app = app;
                this.#dbh = dbh;
            }

            async _authenticateUserPassword ( privateToken ) {
                var user = await this.#dbh.selectRow( q.authUser, [privateToken.id] );

                // user not found or disabled
                if ( !user.data ) return;

                const valid = await this._verifyPasswordHash( user.data.hash, privateToken.hash );

                // password is invalid
                if ( !valid.ok ) return;

                return {
                    "userId": user.data.id,
                    "userName": privateToken.id,
                    "permissions": user.data.permissions,
                };
            }

            async _getUser ( userId ) {
                var res = await this.#dbh.selectRow( q.getUser, [userId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( !res.data ) {
                    return result( [404, "User not found"] );
                }
                else {
                    return res;
                }
            }

            async createUser ( userName, password, enabled, permissions, fields ) {
                if ( !permissions ) permissions = {};
                if ( !fields ) fields = {};

                // lowercase username
                userName = userName.toLowerCase();

                // validate user name
                let res = this.validateUserName( userName );

                if ( !res.ok ) return res;

                // generate password, if password is empty
                if ( password == null || password === "" ) {
                    password = crypto.randomBytes( 32 ).toString( "hex" );
                }

                // validate password
                else {
                    res = this.validatePassword( password );

                    if ( !res.ok ) return res;
                }

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                // validate email
                if ( fields.email != null ) {
                    fields.email = fields.email.toLowerCase();

                    res = this.validateEmail( fields.email );

                    if ( !res.ok ) return res;
                }

                // validate telegram name
                if ( fields.telegram_name != null ) {
                    fields.telegram_name = fields.telegram_name.toLowerCase();

                    res = this.validateTelegramUserName( fields.telegram_name );

                    if ( !res.ok ) return res;
                }

                // generate password hash
                const hash = await this._generatePasswordHash( userName, password );

                if ( !hash.ok ) return hash;

                // start transaction
                const user = await this.#dbh.begin( async dbh => {

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

                    // sqlite
                    if ( dbh.isSqlite ) {
                        res = await dbh.do( sql`INSERT INTO "user"`.VALUES( [fields] ).sql`ON CONFLICT DO NOTHING` );

                        userId = dbh.lastInsertRowId;
                    }

                    // pgsql
                    else {
                        res = await dbh.selectRow( sql`INSERT INTO "user"`.VALUES( [fields] ).sql`ON CONFLICT DO NOTHING RETURNING "id"` );

                        if ( res.data ) userId = res.data.id;
                    }

                    if ( !res.ok ) throw res;

                    if ( !res.rows ) return result( [409, "User already exists"] );

                    // insert user hash
                    res = await dbh.do( q.insertHash, [fields.guid, hash.data] );

                    // unable to insert user hash
                    if ( !res.ok ) throw res;

                    // enable user
                    if ( enabled ) {
                        res = await dbh.do( q.setUserEnabled, [true, userId, false] );

                        if ( !res.ok ) throw res;
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

            async setUserPassword ( userId, password, dbh ) {
                if ( !dbh ) dbh = this.#dbh;

                // validate password
                var res = this.validatePassword( password );

                if ( !res.ok ) return res;

                var user = await this._getUser( userId );

                if ( !user.ok ) return user;

                // generate password hash
                const hash = await this._generatePasswordHash( user.data.name, password );

                if ( !hash.ok ) return hash;

                res = await dbh.do( q.updateHash, [hash.data, user.data.guid] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUserToken( user.data.name );

                    return res;
                }
                else {
                    return result( 500 );
                }
            }

            async setUserEnabled ( userId, enabled ) {
                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

                var user = await this._getUser( userId );

                if ( !user.ok ) return user;

                const res = await this.#dbh.do( q.setUserEnabled, [enabled, userId, !enabled] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUser( userId );

                    return res;
                }
                else {
                    return result( 204 );
                }
            }

            async removeUser ( userId ) {
                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to remove root user"] );

                const res = await this.#dbh.do( q.removeUser, [userId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUser( userId );

                    return res;
                }
                else {
                    return result( [404, "User not found"] );
                }
            }

            async setUserPermissions ( userId, permissions ) {

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var res = await this.#dbh.do( q.updatePermissions, [sql.JSON( permissions ), userId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( !res.rows ) {
                    return result( [404, "User not found"] );
                }
                else {
                    this._invalidateUser( userId );

                    return result( 200 );
                }
            }

            async updateUserPermissions ( userId, permissions ) {

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var user = await this._getUser( userId );

                if ( !user.ok ) return user;

                permissions = {
                    ...user.data.permissions,
                    ...permissions,
                };

                var res = await this.#dbh.do( q.updatePermissions, [sql.JSON( permissions ), userId] );

                if ( !res.ok ) {
                    return res;
                }
                else {
                    this._invalidateUser( userId );

                    return result( 200 );
                }
            }

            async _generatePasswordHash ( userName, password ) {
                return this.#app.threads.call( "argon2/hash", this._getHash( password + userName ) );
            }

            async _verifyPasswordHash ( hash, passwordHash ) {
                var id = hash + "/" + passwordHash,
                    res = this.#verifyPasswordHashCache.get( id );

                if ( res ) return res;

                res = await this.#app.threads.call( "argon2/verify", hash, passwordHash );

                this.#verifyPasswordHashCache.set( id, res );

                return res;
            }
    } );
