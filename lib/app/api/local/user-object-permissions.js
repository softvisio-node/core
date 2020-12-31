const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );

const QUERIES = {
    "get": sql`SELECT "permissions" FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_guid", "permissions") VALUES (?, ?, ?) ON CONFLICT ("user_id", "object_guid") DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "getUsers": sql`SELECT * FROM "object_permissions" WHERE "object_guid" = ?`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #permissions = {};

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
                    if ( /[^a-z-]/.test( type ) ) return result( [400, `Object name "${type}" is invalid`] );

                    for ( const action in permissions[type].actions ) {
                        if ( /[^a-z-]/.test( action ) ) return result( [400, `Action name "${action}" for object "${type}" is invalid`] );
                    }

                    for ( const group in permissions[type].groups ) {
                        if ( /[^a-z-]/.test( group ) ) return result( [400, `Group name "${group}" for object "${type}" is invalid`] );

                        for ( const action of permissions[type].groups[group].actions ) {
                            if ( !( action in permissions[type].actions ) ) return result( [400, `Action "${action}" in group "${group}" of object "${type}" is not valid`] );
                        }
                    }
                }

                return result( 200 );
            }

            // XXX
            async setUserObjectPermissions ( userId, objectGuid, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validateObjectPermissionName( permission );

                    if ( !res.ok ) return res;
                }

                const res = await dbh.do( QUERIES.set, [userId, objectGuid, sql.JSON( permissions ), sql.JSON( permissions )] );

                if ( !res.ok || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            // XXX
            async updateUserObjectPermissions ( userId, objectGuid, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validateObjectPermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var res = await dbh.selectRow( QUERIES.get, [userId, objectGuid] );

                if ( !res.ok ) return res;

                permissions = sql.JSON( {
                    ...( res.data.permissions || {} ),
                    ...permissions,
                } );

                return this.setUserObjectPermissions( userId, objectGuid, permissions, { dbh } );
            }

            async removeUserObjectPermissions ( userId, objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.remove, [userId, objectGuid] );

                if ( !res.ok || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            async getObjectUsers ( objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.selectAll( QUERIES.getUsers, [objectGuid] );

                return res;
            }
    } );
