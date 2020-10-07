const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );

const q = {
    "get": sql`SELECT "permissions" FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_guid", "permissions") VALUES (?, ?, ?) ON CONFLICT ("user_id", "object_guid") DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "user_id" = ? AND "object_guid" = ?`.prepare(),
    "getUsers": sql`SELECT * FROM "object_permissions" WHERE "object_guid" = ?`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );
            }

            async setUserObjectPermissions ( userId, objectGuid, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                const res = await dbh.do( q.set, [userId, objectGuid, sql.JSON( permissions ), sql.JSON( permissions )] );

                if ( !res.ok || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            async updateUserObjectPermissions ( userId, objectGuid, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validatePermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var res = await dbh.selectRow( q.get, [userId, objectGuid] );

                if ( !res.ok ) return res;

                permissions = sql.JSON( {
                    ...( res.data.permissions || {} ),
                    ...permissions,
                } );

                return this.setUserObjectPermissions( userId, objectGuid, permissions, { dbh } );
            }

            async removeUserObjectPermissions ( userId, objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( q.remove, [userId, objectGuid] );

                if ( !res.ok || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            async getObjectUsers ( objectGuid, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.selectAll( q.getUsers, [objectGuid] );

                return res;
            }
    } );
