const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Lru = require( "lru-cache" );

const QUERIES = {
    "get": sql`SELECT "enabled", "permissions" FROM "object_permissions" WHERE "object_id" = ? AND "user_id" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("object_id", "user_id", "permissions") VALUES (?, ?, ?) ON CONFLICT ("object_id", "user_id") DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "object_id" = ? AND "user_id" = ?`.prepare(),
    "setEnabled": sql`UPDATE "object_permissions" SET "enabled" = ? WHERE "object_id" = ? AND "user_id" = ? AND "enabled" = ?`.prepare(),
    "getUsers": sql`
        SELECT
            "object_permissions"."object_id" AS "object_id",
            "object_permissions"."user_id" AS "user_id",
            "object_permissions"."enabled" AS "enabled",
            "object_permissions"."permissions" AS "permissions",
            "user"."name" AS "user_name",
            CASE
                WHEN "user"."gravatar" IS NOT NULL
                THEN 'https://s.gravatar.com/avatar/' || "user"."gravatar" || '?d=' || ?
                ELSE ?
            END "avatar"
        FROM
            "object_permissions",
            "user"
        WHERE
            "object_id" = ?
            AND "object_permissions"."user_id" = "user"."id"
    `.prepare(),
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
                const objectIds = {},
                    objectTypes = {};

                // validate permissions
                for ( const id in permissions ) {
                    var [objectId, objectType] = id.split( ":" );

                    objectId = parseInt( objectId );

                    if ( typeof objectId !== "number" || objectId <= 0 || objectId > 255 ) return result( [400, `Object id "${objectId}" must be > 0 and <= 255`] );

                    if ( /[^a-z-]/.test( objectType ) ) return result( [400, `Object type name "${objectType}" is invalid`] );

                    if ( objectId in objectIds ) return result( [400, `Object id "${objectId}" is not unique`] );
                    if ( objectType in objectTypes ) return result( [400, `Object type "${objectType}" is not unique`] );

                    objectIds[objectId] = objectType;
                    objectTypes[objectType] = objectId;

                    this.#permissions[objectId] = permissions[id];

                    for ( const permission in permissions[objectId] ) {
                        if ( /[^a-z-]/.test( permission ) ) return result( [400, `Permission name "${permission}" for object type "${objectType}" is invalid`] );
                    }
                }

                return result( 200 );
            }

            #getObjectType ( objectId ) {
                return Number( BigInt( objectId ) >> 55n );
            }

            async #getObjectPermissions ( objectId, userId ) {
                const cacheId = objectId + "/" + userId;

                var objectPermissions = this.#cache.get( cacheId );

                if ( !objectPermissions ) {
                    const res = await this.dbh.selectRow( QUERIES.get, [objectId, userId] );

                    // dbh error
                    if ( !res.ok ) return;

                    // permissions found
                    else if ( res.data ) {
                        objectPermissions = {
                            "enabled": res.data.enabled,
                            "permissions": res.data.permissions,
                        };
                    }

                    // permissions not set
                    else {
                        objectPermissions = {
                            "enabled": false,
                            "permissions": {},
                        };
                    }

                    // cache permissions
                    this.#cache.set( cacheId, objectPermissions );
                }

                return objectPermissions;
            }

            async #setObjectPermissions ( objectId, userId, permissions, options = {} ) {

                // filter disabled permissions
                permissions = Object.fromEntries( Object.entries( permissions ).filter( entry => entry[1] ) );

                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.set, [objectId, userId, sql.JSON( permissions ), sql.JSON( permissions )] );

                const cacheId = objectId + "/" + userId;

                // drop cache
                this.#cache.del( cacheId );

                return res;
            }

            async hasObjectPermissions ( objectId, userId, permissions ) {

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( objectId, userId );

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

            async setObjectPermissions ( objectId, userId, permissions, options ) {
                const objectType = this.#getObjectType( objectId );

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType][permission] ) return result( [400, `Object permissions are invalid`] );
                }

                return this.#setObjectPermissions( objectId, userId, permissions, options );
            }

            async updateObjectPermissions ( objectId, userId, permissions, options ) {
                const objectType = this.#getObjectType( objectId );

                // validate permissions
                for ( const permission in permissions ) {
                    if ( !this.#permissions[objectType][permission] ) return result( [400, `Object permissions are invalid`] );
                }

                // get object permissions
                const objectPermissions = await this.#getObjectPermissions( objectId, userId );

                // unable to get object permissions
                if ( !objectPermissions ) return result( [500, `Unale to get object permissions`] );

                // merge permissions
                permissions = {
                    ...objectPermissions,
                    ...permissions,
                };

                return this.#setObjectPermissions( objectId, userId, permissions, options );
            }

            async setObjectUserEnabled ( objectId, userId, enabled, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.setEnabled, [enabled, objectId, userId, !enabled] );

                // dbh error
                if ( !res.ok ) {
                    return res;
                }

                // modified
                else if ( res.rows ) {
                    const cacheId = objectId + "/" + userId;

                    // drop cache
                    this.#cache.del( cacheId );

                    return res;
                }

                // not modified
                else {
                    return result( 204 );
                }
            }

            async removeObjectUser ( objectId, userId, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.remove, [objectId, userId] );

                // dbh error
                if ( !res.ok ) {
                    return res;
                }
                else {
                    const cacheId = objectId + "/" + userId;

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

            async getObjectUsers ( objectId, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.selectAll( QUERIES.getUsers, [this.api.defaultGravatarImage, this.api.defaultGravatarUrl, objectId] );

                return res;
            }

            async getObjectUserPermissions ( objectId, userId, options = {} ) {
                const objectType = this.#getObjectType( objectId );

                const objectPermissions = await this.#getObjectPermissions( objectId, userId );

                if ( !objectPermissions ) return result( [500, `Unable to get object permissions`] );

                const permissions = [];

                for ( const permission in this.#permissions[objectType] ) {
                    permissions.push( {
                        "id": permission,
                        "name": this.#permissions[objectType][permission].name,
                        "desription": this.#permissions[objectType][permission].desription,
                        "enabled": !!objectPermissions[permission],
                    } );
                }

                return result( 200, permissions );
            }
    } );
