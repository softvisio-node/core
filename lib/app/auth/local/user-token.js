const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const { TOKEN_TYPE_TOKEN } = require( "../../../const" );

const q = {
    "auth": sql`
SELECT
    "user"."id",
    "user"."name",
    "user"."permissions"
FROM
    "user",
    "user_session",
    "auth_hash"
WHERE
    "user"."id" = "user_session"."user_id"
    AND "user_session"."id" = "auth_hash"."id"
    AND "user"."enabled" = TRUE
    AND "user_session"."id" = ?
    AND "auth_hash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "storeToken": sql`INSERT INTO "user_session" ("id", "user_id") VALUES (?, ?)`.prepare(),
    "setEnabled": sql`UPDATE "user_token" SET "enabled" = ? WHERE "id" = ? AND "enabled" = ?`.prepare(),
    "update": sql`UPDATE "user_token" SET "permissions" = ? WHERE "id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_token" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
        constructor ( app, dbh ) {
            super( app, dbh );
        }

        // TODO
        async authenticateUserToken ( privateToken ) {
            var user = await this.dbh.selectRow( q.auth, [privateToken.id, privateToken.hash] );

            // user not found or disabled
            if ( !user.data ) return;

            return {
                "userId": user.data.id,
                "userName": user.data.name,
                "permissions": user.data.permissions,
            };
        }

        // TODO
        async createUserToken ( userId ) {

            // resolve user
            var user = await this.getUser( userId );

            // user error
            if ( !user.isOk() ) return user;

            var token = this.generateToken( TOKEN_TYPE_SESSION );

            var res = await this.dbh.begin( async ( dbh ) => {

                // insert hash
                var res = await dbh.do( q.storeHash, [token.id, token.hash] );

                if ( !res.isOk() || !res.rows ) throw result( 500 );

                res = await dbh.do( q.storeToken, [token.id, user.data.id] );

                if ( !res.isOk() || !res.rows ) throw result( 500 );

                return result( 200, {
                    "id": token.id,
                    "type": TOKEN_TYPE_SESSION,
                    "token": token.token,
                    "userId": user.data.id,
                    "userName": user.data.name,
                    "permissions": user.data.permissions,
                } );
            } );

            return res;
        }

        async removeUserToken ( tokenId ) {
            var res = await this.dbh.do( q.remove, [tokenId] );

            if ( !res.isOk() ) return res;

            if ( !res.rows ) return result( 404 );

            this.invalidateUserToken( tokenId );

            return result( 200 );
        }

        async setUserTokenEnabled ( tokenId, enabled ) {
            const res = await this.dbh.do( q.setEnabled, [enabled, tokenId, !enabled] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( res.rows ) {
                this.invalidateUserToken( tokenId );

                return res;
            }
            else {
                return result( 204 );
            }
        }

        async setUserTokenPermissions ( tokenId, permissions ) {
            if ( !permissions ) permissions = {};

            var res = await this.dbh.do( q.update, [sql.JSON( permissions ), tokenId] );

            if ( !res.isOk() ) {
                return res;
            }
            else if ( res.rows ) {
                this.invalidateUserToken( tokenId );

                return result( 200 );
            }
            else {
                return result( 404 );
            }
        }

        // TODO
        async updateUserTokenPermissions ( userId, permissions ) {
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
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 4:9           | no-unused-vars               | 'TOKEN_TYPE_TOKEN' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 59:45         | no-undef                     | 'TOKEN_TYPE_SESSION' is not defined.                                           |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 74:29         | no-undef                     | 'TOKEN_TYPE_SESSION' is not defined.                                           |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
