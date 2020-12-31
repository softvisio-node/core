const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Lru = require( "lru-cache" );

const QUERIES = {
    "get": sql`SELECT "groups" FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_type", "object_guid", "groups") VALUES (?, ?, ?, ?) ON CONFLICT ("user_id", "object_guid") DO UPDATE SET "groups" = ?`.prepare(),
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

                // validate permissions
                for ( const type in permissions ) {
                    if ( /[^a-z-]/.test( type ) ) return result( [400, `Object type "${type}" is invalid`] );

                    this.#permissions[type] = {
                        "permissions": {},
                        "groups": {},
                    };

                    for ( const permission in permissions[type].permissions ) {
                        if ( /[^a-z-]/.test( permission ) ) return result( [400, `Permission name "${permission}" for object "${type}" is invalid`] );

                        this.#permissions[type].permissions[permission] = { ...permissions[type].permissions[permission] };
                    }

                    for ( const group in permissions[type].groups ) {
                        if ( /[^a-z-]/.test( group ) ) return result( [400, `Group name "${group}" for object "${type}" is invalid`] );

                        this.#permissions[type].groups[group] = { ...permissions[type].groups[group] };
                        this.#permissions[type].groups[group].permissions = {};

                        for ( const permission of permissions[type].groups[group].permissions ) {
                            if ( !( permission in permissions[type].permissions ) ) return result( [400, `Permission "${permission}" in group "${group}" of object "${type}" is not valid`] );

                            this.#permissions[type].groups[group].permissions[permission] = true;
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

                    objectPermissions = {
                        "groups": {},
                        "permissions": {},
                    };

                    // permissions found
                    if ( res.data ) {

                        // if object type is registered
                        if ( this.#permissions[res.data.type] ) {

                            // filter groups
                            for ( const group in res.data.groups ) {

                                // skip old groups
                                if ( !this.#permissions[res.data.type].groups[group] ) continue;

                                objectPermissions.groups[group] = res.data.groups[group];
                            }

                            // build permisions
                            objectPermissions.permissions = this.buildObjectPermissions( res.data.type, res.data.groups );
                        }
                    }

                    // cache permissions
                    this.#cache.set( cacheId, objectPermissions );
                }

                return objectPermissions;
            }

            async #setObjectPermissions ( userId, objectType, objectGuid, groups, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.set, [userId, objectType, objectGuid, sql.JSON( groups ), sql.JSON( groups )] );

                const cacheId = userId + "/" + objectGuid;

                this.#cache.del( cacheId );

                return res;
            }

            buildObjectPermissions ( objectType, groups ) {
                var permissions = {};

                if ( this.#permissions[objectType] ) {
                    for ( const group in groups ) {

                        // skip old groups
                        if ( !this.#permissions[objectType].groups[group] ) continue;

                        // skip disabled groups
                        if ( !groups[group] ) continue;

                        // add group permissions
                        permissions = {
                            ...permissions,
                            ...this.#permissions[objectType].groups[group].permissions,
                        };
                    }
                }

                return permissions;
            }

            async hasObjectPermissions ( userId, objectGuid, permissions ) {

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return false;

                if ( !Array.isArray( permissions ) ) permissions = [permissions];

                for ( const permission in permissions ) {
                    if ( objectPermissions.permissions[permission] ) return true;
                }

                return false;
            }

            async setObjectPermissions ( userId, objectType, objectGuid, groups, options ) {

                // validate groups
                for ( const group in groups ) {
                    if ( !this.#permissions[objectType].groups[group] ) return result( [400, `Object permissions are invalid`] );
                }

                return this.#setObjectPermissions( userId, objectType, objectGuid, groups, options );
            }

            async updateObjectPermissions ( userId, objectType, objectGuid, groups, options ) {

                // validate permissions
                for ( const group in groups ) {
                    if ( !this.#permissions[objectType].groups[group] ) return result( [400, `Object permissions are invalid`] );
                }

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( userId, objectGuid );

                // unable to get object permissions
                if ( !objectPermissions ) return result( [500, `Unale to get object permissions`] );

                // merge permissions
                groups = {
                    ...objectPermissions.groups,
                    ...groups,
                };

                return this.#setObjectPermissions( userId, objectType, objectGuid, groups, options );
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
