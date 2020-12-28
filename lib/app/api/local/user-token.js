const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Base = require( "../../mixins/base" );
const Read = require( "../../mixins/read" );

const { TOKEN_TYPE_TOKEN } = require( "../../../const" );

const QUERIES = {
    "auth": sql`
        SELECT
            "user"."id",
            "user"."name",
            "user"."permissions" AS "user_permissions",
            "user_token"."permissions" AS "token_permissions"
        FROM
            "user",
            "user_token",
            "user_hash"
        WHERE
            "user_token"."user_id" = "user"."id"
            AND "user_token"."id" = "user_hash"."id"
            AND "user"."enabled" = TRUE
            AND "user_token"."enabled" = TRUE
            AND "user_token"."id" = ?
            AND "user_hash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "user_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "storeToken": sql`INSERT INTO "user_token" ("id", "user_id", "name", "enabled", "permissions" ) VALUES (?, ?, ?, ?, ?)`.prepare(),
    "setEnabled": sql`UPDATE "user_token" SET "enabled" = ? WHERE "id" = ?`.prepare(),
    "update": sql`UPDATE "user_token" SET "permissions" = ? WHERE "id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_token" WHERE "id" = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM "user_token" WHERE "id" = ?`.prepare(),
    "getUserTokenWithPermissons": sql`SELECT "user_token".*, "user"."permissions" AS "user_permissions" FROM "user_token", "user" WHERE "user_token"."id" = ? AND "user_token"."user_id" = "user"."id"`.prepare(),
};

module.exports = mixin( Super =>
    class extends Super {
            #read;

            async _authenticateUserToken ( privateToken ) {
                var res = await this.dbh.selectRow( QUERIES.auth, [privateToken.id, privateToken.hash] );

                // token not found, user disabled, token disabled or hash is invalid
                if ( !res.data ) return;

                return {
                    "userId": res.data.id,
                    "username": res.data.name,
                    "permissions": this._mergeUserPermissions( res.data.user_permissions, res.data.token_permissions ),
                };
            }

            async createUserToken ( userId, name, enabled, permissions = {}, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validateTokenPermissionName( permission );

                    if ( !res.ok ) return res;
                }

                // resolve user
                var user = await this._getUser( userId, { dbh } );

                // user error
                if ( !user.ok ) return user;

                // validate token permissions
                var res = this.#validateTokenPermissions( user.data.permissions, permissions );

                // permissions error
                if ( !res.ok ) return res;

                var token = this._generateToken( TOKEN_TYPE_TOKEN );

                // start transaction
                res = await dbh.begin( async dbh => {

                    // insert token
                    var res = await dbh.do( QUERIES.storeToken, [token.id, userId, name, enabled, sql.JSON( permissions )] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    // insert hash
                    res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    return result( 200, {
                        "id": token.id,
                        "type": TOKEN_TYPE_TOKEN,
                        "token": token.token,
                        "userId": userId,
                        "username": user.data.name,
                        "permissions": this._mergeUserPermissions( user.data.permissions, permissions ),
                    } );
                } );

                return res;
            }

            async getUserToken ( tokenId, options = {} ) {
                const dbh = options.dbh || this.dbh;

                var token = await dbh.selectRow( QUERIES.getUserTokenWithPermissons, [tokenId] );

                if ( !token.ok ) return token;

                if ( !token.data ) return result( 404 );

                ( token.data.permissions = this._mergeUserPermissions( token.data.user_permissions, token.data.permissions ) ), delete token.data.user_permissions;

                return token;
            }

            async getUserTokens ( userId, options ) {
                if ( !this.#read ) {
                    this.#read = new ( Read( Base() ) )( this );
                }

                var where = this.dbh.WHERE( sql`"user_token"."user_id" = "user"."id" AND "user"."id" = ${userId}` );

                // get by id
                if ( options.id ) {
                    where.and( sql`"user_token"."id" = ${options.id}` );
                }

                // get all matched rows
                else {

                    // filter search
                    if ( options.where && options.where.search ) {
                        where.and( { "user_token.name": options.where.search } );

                        delete options.where.search;
                    }
                }

                const totalQuery = sql`SELECT COUNT(*) AS "total" FROM "user_token", "user"`.WHERE( where );

                const mainQuery = sql`SELECT "user_token".*, "user"."permissions" AS "user_permissions" FROM "user_token", "user"`.WHERE( where );

                var tokens = await this.#read._read( totalQuery, mainQuery, options );

                if ( tokens.data ) {
                    for ( const token of tokens.data ) {
                        ( token.permissions = this._mergeUserPermissions( token.user_permissions, token.permissions ) ), delete token.user_permissions;
                    }
                }

                return tokens;
            }

            async removeUserToken ( tokenId, options = {} ) {
                const dbh = options.dbh || this.dbh;

                var res = await dbh.do( QUERIES.remove, [tokenId] );

                if ( !res.ok ) return res;

                if ( !res.rows ) return result( 404 );

                this._invalidateUserToken( tokenId );

                return result( 200 );
            }

            async setUserTokenEnabled ( tokenId, enabled, options = {} ) {
                const dbh = options.dbh || this.dbh;

                const res = await dbh.do( QUERIES.setEnabled, [enabled, tokenId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUserToken( tokenId );

                    return res;
                }
                else {
                    return result( 404 );
                }
            }

            // XXX
            async getUserTokenPermissions ( userId, options ) {
                var user = await this._getUser( userId, options );

                if ( !user.ok ) return user;

                const userPermissions = this._userPermissions,
                    permissions = [];

                for ( const id in userPermissions ) {
                    permissions.push( {
                        id,
                        "name": userPermissions[id].name,
                        "description": userPermissions[id].description,
                        "enabled": !!user.data.permissions[id],
                    } );
                }

                return result( 200, permissions );
            }

            // XXX valigate token permissions againts user permissions
            async setUserTokenPermissions ( tokenId, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validateTokenPermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var res = await dbh.do( QUERIES.update, [sql.JSON( permissions ), tokenId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUserToken( tokenId );

                    return result( 200 );
                }
                else {
                    return result( 404 );
                }
            }

            // XXX valigate token permissions againts user permissions
            async updateUserTokenPermissions ( tokenId, permissions, options = {} ) {
                const dbh = options.dbh || this.dbh;

                // validate permissions
                for ( const permission in permissions ) {
                    const res = this.validateTokenPermissionName( permission );

                    if ( !res.ok ) return res;
                }

                var token = await dbh.selectRow( QUERIES.getUserToken, [tokenId] );

                if ( !token.ok ) return token;

                if ( !token.data ) return result( 404 );

                permissions = {
                    ...token.data.permissions,
                    ...permissions,
                };

                var res = await dbh.do( QUERIES.update, [sql.JSON( permissions ), tokenId] );

                if ( !res.ok ) {
                    return res;
                }
                else if ( res.rows ) {
                    this._invalidateUserToken( tokenId );

                    return result( 200 );
                }
                else {
                    return result( 404 );
                }
            }

            #validateTokenPermissions ( userPermissions, tokenPermissions ) {
                for ( const name in tokenPermissions ) {

                    // if user permission is not set
                    if ( !userPermissions[name] ) return result( [400, `Token permission "${name}" is not valid`] );
                }

                return result( 200 );
            }
    } );
