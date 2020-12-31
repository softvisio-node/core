const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Lru = require( "lru-cache" );

const QUERIES = {
    "get": sql`SELECT "permissions" FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_type", "object_guid", "permissions") VALUES (?, ?, ?, ?) ON CONFLICT ("user_id", "object_guid") DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
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
                for ( const type in permissions ) {
                    if ( /[^a-z-]/.test( type ) ) return result( [400, `Object type "${type}" is invalid`] );

                    for ( const action in permissions[type].actions ) {
                        if ( /[^a-z-]/.test( action ) ) return result( [400, `Action name "${action}" for object "${type}" is invalid`] );
                    }

                    for ( const permission in permissions[type].permissions ) {
                        if ( /[^a-z-]/.test( permission ) ) return result( [400, `Permission name "${permission}" for object "${type}" is invalid`] );

                        for ( const action of permissions[type].permissions[permission].actions ) {
                            if ( !( action in permissions[type].actions ) ) return result( [400, `Action "${action}" in permission "${permission}" of object "${type}" is not valid`] );
                        }
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
                    if ( res.data ) objectPermissions = res.data.permissions;

                    // permissions not found
                    else objectPermissions = {};

                    // cache permissions
                    this.#cache.set( cacheId, objectPermissions );
                }

                return objectPermissions;
            }

            async #setObjectPermissions ( userId, objectType, objectGuid, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const cacheId = userId + "/" + objectGuid;

                const res = await dbh.do( QUERIES.set, [userId, objectType, objectGuid, sql.JSON( permissions ), sql.JSON( permissions )] );

                // dbh error
                if ( !res.ok ) {
                    this.#cache.del( cacheId );

                    return res;
                }

                // updated
                else {
                    this.#cache.set( cacheId, permissions );

                    return res;
                }
            }

            async hasObjectPermissions ( userId, objectGuid, permissions ) {

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return false;

                if ( !Array.isArray( permissions ) ) permissions = [permissions];

                for ( const permission in permissions ) {
                    if ( objectPermissions[permission] ) return true;
                }

                return false;
            }

            async setObjectPermissions ( userId, objectType, objectGuid, permissions, options ) {

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType].permissions[permission] ) return result( [400, `Object permissions are invalid`] );
                }

                return this.#setObjectPermissions( userId, objectType, objectGuid, permissions, options );
            }

            async updateObjectPermissions ( userId, objectType, objectGuid, permissions, options ) {

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType].permissions[permission] ) return result( [400, `Object permissions are invalid`] );
                }

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return false;

                // merge permissions
                permissions = {
                    ...objectPermissions,
                    ...permissions,
                };

                return this.#setObjectPermissions( userId, objectType, objectGuid, permissions, options );
            }

            async removeObjectPermissions ( userId, objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.remove, [userId, objectGuid] );

                // dbh error
                if ( !res.ok ) {
                    return res;
                }
                else {
                    const cacheId = userId + "/" + objectGuid;

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
