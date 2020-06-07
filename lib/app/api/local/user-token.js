const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const { TOKEN_TYPE_TOKEN } = require( "../../../const" );

const q = {
    "auth": sql`
SELECT
    "user"."id",
    "user"."name",
    "user"."permissions" AS "user_permissions",
    "user_token"."permissions" AS "token_permissions"
FROM
    "user",
    "user_token",
    "auth_hash"
WHERE
    "user_token"."user_id" = "user"."id"
    AND "user_token"."id" = "auth_hash"."id"
    AND "user"."enabled" = TRUE
    AND "user_token"."enabled" = TRUE
    AND "user_token"."id" = ?
    AND "auth_hash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "storeToken": sql`INSERT INTO "user_token" ("id", "user_id", "name", "enabled", "permissions" ) VALUES (?, ?, ?, ?, ?)`.prepare(),
    "setEnabled": sql`UPDATE "user_token" SET "enabled" = ? WHERE "id" = ?`.prepare(),
    "update": sql`UPDATE "user_token" SET "permissions" = ? WHERE "id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_token" WHERE "id" = ?`.prepare(),
    "getUserTokens": sql`SELECT "user_token".*, "user"."permissions" AS "user_permissions" FROM "user", "user_token" WHERE "user"."id" = "user_token"."user_id" AND "user_token"."user_id" = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM "token" WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }

            async authenticateUserToken ( privateToken ) {
                var res = await this.#dbh.selectRow( q.auth, [privateToken.id, privateToken.hash] );

                // token not found, user disabled, token disabled or hash is invalid
                if ( !res.data ) return;

                return {
                    "userId": res.data.id,
                    "userName": res.data.name,
                    "permissions": this._mergeUserTokenPermissions( res.data.user_permissions, res.data.token_permissions ),
                };
            }

            async createUserToken ( userId, name, enabled, permissions = {} ) {

                // resolve user
                var user = await this.getUser( userId );

                // user error
                if ( !user.isOk() ) return user;

                var token = this.generateToken( TOKEN_TYPE_TOKEN );

                // start transaction
                var res = await this.#dbh.begin( async ( dbh ) => {

                    // insert hash
                    var res = await dbh.do( q.storeHash, [token.id, token.hash] );

                    if ( !res.isOk() || !res.rows ) throw result( 500 );

                    res = await dbh.do( q.storeToken, [token.id, user.data.id, name, enabled, sql.JSON( permissions )] );

                    if ( !res.isOk() || !res.rows ) throw result( 500 );

                    return result( 200, {
                        "id": token.id,
                        "type": TOKEN_TYPE_TOKEN,
                        "token": token.token,
                        "userId": user.data.id,
                        "userName": user.data.name,
                        "permissions": this._mergeUserTokenPermissions( user.data.permissions, permissions ),
                    } );
                } );

                return res;
            }

            async getUserTokens ( userId ) {
                var tokens = await this.#dbh.selectAll( q.getUserTokens, [userId] );

                if ( tokens.data ) {
                    for ( const token of tokens.data ) {
                        token.permissions = this._mergeUserTokenPermissions( token.user_permissions, token.permissions );

                        delete token.user_permissions;
                    }
                }

                return tokens;
            }

            async removeUserToken ( tokenId ) {
                var res = await this.#dbh.do( q.remove, [tokenId] );

                if ( !res.isOk() ) return res;

                if ( !res.rows ) return result( 404 );

                this.invalidateUserToken( tokenId );

                return result( 200 );
            }

            async setUserTokenEnabled ( tokenId, enabled ) {
                const res = await this.#dbh.do( q.setEnabled, [enabled, tokenId] );

                if ( !res.isOk() ) {
                    return res;
                }
                else if ( res.rows ) {
                    this.invalidateUserToken( tokenId );

                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            async setUserTokenPermissions ( tokenId, permissions = {} ) {
                var res = await this.#dbh.do( q.update, [sql.JSON( permissions ), tokenId] );

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

            async updateUserTokenPermissions ( tokenId, permissions = {} ) {
                var token = await this.#dbh.selectRow( q.getUserToken, [tokenId] );

                if ( !token.isOk() ) return token;

                if ( !token.data ) return result( 404 );

                permissions = {
                    ...token.data.permissions,
                    ...permissions,
                };

                var res = await this.#dbh.do( q.update, [sql.JSON( permissions ), tokenId] );

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

            _mergeUserTokenPermissions ( userPermissions, tokenPermissions ) {
                var permissions = {};

                for ( const permission in userPermissions ) {
                    if ( userPermissions[permission] ) {
                        permissions[permission] = tokenPermissions[permission];
                    }
                }

                return permissions;
            }
    } );
