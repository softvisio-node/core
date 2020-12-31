const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Lru = require( "lru-cache" );

const QUERIES = {
    "get": sql`SELECT "enabled", "type", "permissions" FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_type", "object_guid", "permissions") VALUES (?, ?, ?, ?) ON CONFLICT ("user_id", "object_guid") DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "setEnabled": sql`UPDATE "object_permissions" SET "enabled" = ? WHERE "user_id" = ? AND "object_guid" = ? AND "enabled" = ?`.prepare(),
    "getUsers": sql`SELECT * FROM "object_permissions" WHERE "object_guid" = ?`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};
            #cache = new Lru( {
                "max": 10000,
            } );

            async $init ( options ) {
                var res;

                if ( options.objectPermissions ) {
                    process.stdout.write( "Loading object permissions ... " );
                    res = await this.#init( options.objectPermissions );
                    console.log( res + "" );

                    if ( !res.ok ) return res;
                }

                res = super.$init ? await super.$init( options ) : result( 200 );

                return res;
            }

            async #init ( permissions ) {
                this.#permissions = permissions;

                // validate permissions
                for ( const objectType in permissions ) {
                    if ( /[^a-z-]/.test( objectType ) ) return result( [400, `Object type name "${objectType}" is invalid`] );

                    for ( const permission in permissions[objectType] ) {
                        if ( /[^a-z-]/.test( permission ) ) return result( [400, `Permission name "${permission}" for object type "${objectType}" is invalid`] );
                    }
                }

                return result( 200 );
            }

            async #getObjectPermissions ( userId, objectGuid ) {
                const cacheId = userId + "/" + objectGuid;

                var objectPermissions = this.#cache.get( cacheId );

                if ( !objectPermissions ) {
                    const res = await this.dbh.selectRow( QUERIES.get, [userId, objectGuid] );

                    // dbh error
                    if ( !res.ok ) return;

                    // permissions found
                    else if ( res.data ) {
                        objectPermissions = {
                            "enabled": res.data.enabled,
                            "type": res.data.type,
                            "permissions": res.data.permissions,
                        };
                    }

                    // permissions not set
                    else {
                        objectPermissions = {
                            "enabled": false,
                            "type": null,
                            "permissions": {},
                        };
                    }

                    // cache permissions
                    this.#cache.set( cacheId, objectPermissions );
                }

                return objectPermissions;
            }

            async #setObjectPermissions ( userId, objectType, objectGuid, permissions, options = {} ) {

                // filter disabled permissions
                permissions = Object.fromEntries( Object.entries( permissions ).filter( entry => entry[1] ) );

                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.set, [userId, objectType, objectGuid, sql.JSON( permissions ), sql.JSON( permissions )] );

                const cacheId = userId + "/" + objectGuid;

                // drop cache
                this.#cache.del( cacheId );

                return res;
            }

            async hasObjectPermissions ( userId, objectGuid, permissions ) {

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return false;

                // user is disabled
                if ( !objectPermissions.enabled ) return false;

                if ( !Array.isArray( permissions ) ) permissions = [permissions];

                for ( const permission in permissions ) {
                    if ( objectPermissions.permissions[permission] ) return true;
                }

                return false;
            }

            async setObjectPermissions ( userId, objectType, objectGuid, permissions, options ) {

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType][permission] ) return result( [400, `Object permissions are invalid`] );
                }

                return this.#setObjectPermissions( userId, objectType, objectGuid, permissions, options );
            }

            async updateObjectPermissions ( userId, objectType, objectGuid, permissions, options ) {

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType][permission] ) return result( [400, `Object permissions are invalid`] );
                }

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return result( [500, `Unale to get object permissions`] );

                // merge permissions
                permissions = {
                    ...objectPermissions,
                    ...permissions,
                };

                return this.#setObjectPermissions( userId, objectType, objectGuid, permissions, options );
            }

            async setObjectUserEnabled ( userId, objectGuid, enabled, options = {} ) {
                const dbh = options.dbh || this.dbh;

                var user = await this._getUser( userId, { dbh } );

                if ( !user.ok ) return user;

                const res = await dbh.do( QUERIES.setEnabled, [enabled, userId, objectGuid, !enabled] );

                // dbh error
                if ( !res.ok ) {
                    return res;
                }

                // modified
                else if ( res.rows ) {
                    const cacheId = userId + "/" + objectGuid;

                    // drop cache
                    this.#cache.del( cacheId );

                    return res;
                }

                // not modified
                else {
                    return result( 204 );
                }
            }

            async removeObjectUser ( userId, objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.remove, [userId, objectGuid] );

                // dbh error
                if ( !res.ok ) {
                    return res;
                }
                else {
                    const cacheId = userId + "/" + objectGuid;

                    // drop cache
                    this.#cache.del( cacheId );

                    // removed
                    if ( res.rows ) {
                        return res;
                    }

                    // not found
                    else {
                        return result( 200 );
                    }
                }
            }

            async getObjectUsers ( objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.selectAll( QUERIES.getUsers, [objectGuid] );

                return res;
            }
    } );
