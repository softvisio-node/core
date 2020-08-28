const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const { toBase58 } = require( "../../../util" );
const sql = require( "../../../sql" );
const crypto = require( "crypto" );
const { "v4": uuidv4 } = require( "uuid" );
const Lru = require( "lru-cache" );
const { ROOT_USER_ID } = require( "../../../const" );
const q = {
    "getUserById": sql`SELECT "id", "guid", "name", "enabled", "permissions" FROM "user" WHERE "id" = ?`.prepare(),
    "getUserByName": sql`SELECT "id", "guid", "name", "enabled", "permissions" FROM "user" WHERE "name" = ?`.prepare(),
    "removeUser": sql`DELETE FROM "user" WHERE "id" = ?`.prepare(),
    "setUserEnabled": sql`UPDATE "user" SET "enabled" = ? WHERE "id" = ? AND "enabled" = ?`.prepare(),
    "upsertHash": sql`INSERT INTO "user_hash" ("id", "hash") VALUES (?, ?) ON CONFLICT ("id") DO UPDATE SET "hash" = ?`.prepare(),
    "authUser": sql`SELECT "user"."id", "user"."permissions", "user_hash"."hash" FROM "user" LEFT JOIN "user_hash" ON "user"."guid" = "user_hash"."id" WHERE "user"."name" = ? AND "user"."enabled" = TRUE`.prepare(),
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
                    "username": privateToken.id,
                    "permissions": user.data.permissions,
                };
            }

            async _getUser ( userId, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                var res;

                if ( typeof userId === "number" ) {
                    res = await dbh.selectRow( q.getUserById, [userId] );
                }
                else {
                    res = await dbh.selectRow( q.getUserByName, [userId] );
                }

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

            async createUser ( username, password, enabled, permissions, fields, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                if ( !permissions ) permissions = {};

                // make a copy
                fields = fields ? { ...fields } : {};

                // lowercase username
                username = username.toLowerCase();

                // validate user name
                if ( this.usernameIsEmail ) {

                    // user is not root
                    if ( !this.userIsRoot( username ) ) {
                        const res = this.validateEmail( username );

                        if ( !res.ok ) return res;

                        if ( fields.email == null ) fields.email = username;
                    }
                }
                else {
                    const res = this.validateUsername( username );

                    if ( !res.ok ) return res;
                }

                // generate password, if password is empty
                if ( password == null || password === "" ) {
                    password = this._generatePassword();
                }

                // validate password
                else {
                    const res = this.validatePassword( password );

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

                    const res = this.validateEmail( fields.email );

                    if ( !res.ok ) return res;
                }

                // validate telegram name
                if ( fields.telegram_name != null ) {
                    fields.telegram_name = fields.telegram_name.toLowerCase();

                    const res = this.validateTelegramUsername( fields.telegram_name );

                    if ( !res.ok ) return res;
                }

                // generate password hash
                const hash = await this._generatePasswordHash( username, password );

                if ( !hash.ok ) return hash;

                // start transaction
                const user = await dbh.begin( async dbh => {

                    // prepare fields
                    fields.name = username;
                    fields.guid = uuidv4();
                    fields.enabled = false;
                    fields.permissions = sql.JSON( permissions );

                    let userId;

                    if ( this.userIsRoot( username ) ) userId = fields.id = ROOT_USER_ID;

                    let res;

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
                    res = await dbh.do( q.upsertHash, [fields.guid, hash.data, hash.data] );

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
                        "name": username,
                        password,
                        enabled,
                        permissions,
                    } );
                } );

                return user;
            }

            async setUserName ( userId, username, password, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                // lowercase username
                username = username.toLowerCase();

                // root user
                if ( this.userIsRoot( username ) ) return result( [400, "Impossible to chanhe root username"] );

                // validate user name
                if ( this.usernameIsEmail ) {
                    const res = this.validateEmail( username );

                    if ( !res.ok ) return res;
                }
                else {
                    const res = this.validateUsername( username );

                    if ( !res.ok ) return res;
                }

                // get user
                const user = await this._getUser( userId );

                // unable to get user
                if ( !user.ok ) return user;

                // generate password, if password is empty
                if ( password == null || password === "" ) {
                    password = this._generatePassword();
                }

                // validate password
                else {
                    const res = this.validatePassword( password );

                    if ( !res.ok ) return res;
                }

                // generate password hash
                const hash = await this._generatePasswordHash( username, password );

                if ( !hash.ok ) return hash;

                // begin transaction
                const res = await dbh.begin( async dbh => {

                    // change username
                    let res = await dbh.do( sql`UPDATE "user" SET "name" = ? WHERE "id" = ?`, [username, user.data.id] );

                    if ( !res.ok ) throw res;

                    // update user hash
                    res = await dbh.do( q.upsertHash, [user.data.guid, hash.data, hash.data] );

                    // unable to insert user hash
                    if ( !res.ok ) throw res;

                    return 200;
                } );

                if ( res.ok ) this._invalidateUser( user.data.id );

                return res;
            }

            // TBD invalidate all sessions, so user must sign in agaion on password changed???
            async setUserPassword ( userId, password, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                // validate password
                var res = this.validatePassword( password );

                if ( !res.ok ) return res;

                var user = await this._getUser( userId, { dbh } );

                if ( !user.ok ) return user;

                // generate password hash
                const hash = await this._generatePasswordHash( user.data.name, password );

                if ( !hash.ok ) return hash;

                res = await dbh.do( q.upsertHash, [user.data.guid, hash.data, hash.data] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {

                    // invalidate user password
                    this._invalidateUserToken( user.data.name );

                    return res;
                }
                else {
                    return result( [500, "Unable to update user authentication hash"] );
                }
            }

            async setUserEnabled ( userId, enabled, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to modify root user"] );

                var user = await this._getUser( userId, { dbh } );

                if ( !user.ok ) return user;

                const res = await dbh.do( q.setUserEnabled, [enabled, user.data.id, !enabled] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUser( user.data.id );

                    return res;
                }
                else {
                    return result( 204 );
                }
            }

            async removeUser ( userId, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                if ( this.userIsRoot( userId ) ) return result( [400, "Unable to remove root user"] );

                const res = await dbh.do( q.removeUser, [userId] );

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

            async setUserPermissions ( userId, permissions, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var res = await dbh.do( q.updatePermissions, [sql.JSON( permissions ), userId] );

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

            async updateUserPermissions ( userId, permissions, options = {} ) {
                const dbh = options.dbh || this.#dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var user = await this._getUser( userId, { dbh } );

                if ( !user.ok ) return user;

                permissions = {
                    ...user.data.permissions,
                    ...permissions,
                };

                var res = await dbh.do( q.updatePermissions, [sql.JSON( permissions ), user.data.id] );

                if ( !res.ok ) {
                    return res;
                }
                else {
                    this._invalidateUser( user.data.id );

                    return result( 200 );
                }
            }

            _generatePassword () {
                return toBase58( crypto.randomBytes( 16 ) );
            }

            async _generatePasswordHash ( username, password ) {
                return this.#app.threads.call( "argon2/hash", this._getHash( password + username ) );
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
