const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const { TOKEN_TYPE_SESSION } = require( "../../../const" );

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
    "remove": sql`DELETE FROM "user_session" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }

            async _authenticateUserSession ( privateToken ) {
                var user = await this.#dbh.selectRow( q.auth, [privateToken.id, privateToken.hash] );

                // user not found or disabled
                if ( !user.data ) return;

                return {
                    "userId": user.data.id,
                    "username": user.data.name,
                    "permissions": user.data.permissions,
                };
            }

            async createUserSession ( userId ) {
                var token = this._generateToken( TOKEN_TYPE_SESSION );

                var res = await this.#dbh.begin( async dbh => {

                    // insert token
                    var res = await dbh.do( q.storeToken, [token.id, userId] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    // insert hash
                    res = await dbh.do( q.storeHash, [token.id, token.hash] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    return result( 200, {
                        "token": token.token,
                    } );
                } );

                return res;
            }

            async removeUserSession ( tokenId ) {
                var res = await this.#dbh.do( q.remove, [tokenId] );

                if ( !res.ok ) return res;

                if ( !res.rows ) return result( 204 );

                this._invalidateUserToken( tokenId );

                return result( 200 );
            }
    } );
