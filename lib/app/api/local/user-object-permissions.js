const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );

const q = {
    "get": sql`SELECT "permissions" FROM "object_permissions" WHERE "user_id" = ? AND "object_id" = ?`.prepare(),
    "set": sql`INSERT INTO "object_permissions" ("user_id", "object_id", "permissions") VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET "permissions" = ?`.prepare(),
    "remove": sql`DELETE FROM "object_permissions" WHERE "user_id" = ? AND "object_id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }

            async setUserObjectPermissions ( userId, objectId, permissions = {} ) {
                var res = await this.#dbh.do( q.set, [userId, objectId, permissions, permissions] );

                if ( !res.isOk() || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            async updateUserObjectPermissions ( userId, objectId, permissions = {} ) {
                var res = await this.#dbh.selectRow( q.get, [userId, objectId] );

                if ( !res.isOk() ) return res;

                permissions = {
                    ...( res.data.permissions || {} ),
                    ...permissions,
                };

                return this.setUserObjectPermissions( userId, objectId, permissions );
            }

            async removeUserObjectPermissions ( userId, objectId ) {
                var res = await this.#dbh.do( q.remove, [userId, objectId] );

                if ( !res.isOk() || res.rows ) {
                    return res;
                }
                else {
                    return result( 404 );
                }
            }
    } );
