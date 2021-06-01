import "#index";

import sql from "#lib/sql";
import Base from "#lib/app/api/prototypes/base";
import Read from "#lib/app/api/prototypes/mixins/read";
import Token from "../auth/token.js";

import CONST from "#lib/const";

const QUERIES = {
    "auth": sql`
        SELECT
            "user"."id",
            "user"."name",
            "user"."permissions" AS "user_permissions",
            "user_token"."permissions" AS "token_permissions",
            "user"."gravatar"
        FROM
            "user",
            "user_token",
            "user_token_hash"
        WHERE
            "user_token"."user_id" = "user"."id"
            AND "user_token"."id" = "user_token_hash"."user_token_id"
            AND "user"."enabled" = TRUE
            AND "user_token"."enabled" = TRUE
            AND "user_token"."id" = ?
            AND "user_token_hash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "user_token_hash" ("user_token_id", "hash") VALUES (?, ?)`.prepare(),
    "insertTokenSqlite": sql`INSERT INTO "user_token" ("user_id", "name", "enabled", "permissions" ) VALUES (?, ?, ?, ?)`.prepare(),
    "insertTokenPgsql": sql`INSERT INTO "user_token" ("user_id", "name", "enabled", "permissions" ) VALUES (?, ?, ?, ?) RETURNING "id"`.prepare(),
    "getIdSqlite": sql`SELECT "id" FROM "user_token" WHERE "rowid" = ?`.prepare(),
    "setEnabled": sql`UPDATE "user_token" SET "enabled" = ? WHERE "id" = ?`.prepare(),
    "update": sql`UPDATE "user_token" SET "permissions" = ? WHERE "id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_token" WHERE "id" = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM "user_token" WHERE "id" = ?`.prepare(),
    "getUserTokenWithPermissons": sql`SELECT "user_token".*, "user"."permissions" AS "user_permissions" FROM "user_token", "user" WHERE "user_token"."id" = ? AND "user_token"."user_id" = "user"."id"`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        #read;

        async _authenticateUserToken ( token ) {
            var res = await this.dbh.selectRow( QUERIES.auth, [token.id, token.hash] );

            // token not found, user disabled, token disabled or hash is invalid
            if ( !res.data ) return;

            return {
                "userId": res.data.id,
                "username": res.data.name,
                "permissions": this._buildUserPermissions( res.data.id, res.data.user_permissions, res.data.token_permissions ),
                "gravatar": res.data.gravatar,
            };
        }

        async createUserToken ( userId, name, enabled, permissions = {}, options = {} ) {
            const dbh = options.dbh || this.dbh;

            // resolve user
            var user = await this._getUser( userId, { dbh } );

            // user error
            if ( !user.ok ) return user;

            // validate token permissions
            var res = this.#validateTokenPermissions( user.data.permissions, permissions );

            // permissions error
            if ( !res.ok ) return res;

            // start transaction
            res = await dbh.begin( async dbh => {
                let id;

                // insert token
                if ( dbh.isSqlite ) {
                    const res = await dbh.do( QUERIES.insertTokenSqlite, [userId, name, enabled, permissions] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = ( await dbh.selectRow( QUERIES.getIdSqlite, [dbh.lastInsertRowId] ) ).data.id;
                }
                else {
                    const res = await dbh.selectRow( QUERIES.insertTokenPgsql, [userId, name, enabled, permissions] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = res.data.id;
                }

                // generate token
                const token = Token.generate( CONST.AUTH_TOKEN, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );

                if ( !res.ok || !res.rows ) throw result( 500 );

                return result( 200, {
                    "id": token.id,
                    "token": token.token,
                    "userId": userId,
                    "username": user.data.name,
                    "permissions": this._buildUserPermissions( userId, user.data.permissions, permissions ),
                } );
            } );

            return res;
        }

        async getUserToken ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithPermissons, [tokenId] );

            if ( !token.ok ) return token;

            if ( !token.data ) return result( 404 );

            ( token.data.permissions = this._buildUserPermissions( token.data.user_id, token.data.user_permissions, token.data.permissions ) ), delete token.data.user_permissions;

            return token;
        }

        async getUserTokens ( userId, options ) {
            if ( !this.#read ) {
                this.#read = new ( Read( Base ) )( this );
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

            const totalQuery = sql`SELECT count(*) AS "total" FROM "user_token", "user"`.WHERE( where );

            const mainQuery = sql`SELECT "user_token".*, "user"."permissions" AS "user_permissions" FROM "user_token", "user"`.WHERE( where );

            var tokens = await this.#read._read( totalQuery, mainQuery, options );

            if ( tokens.data ) {
                for ( const token of tokens.data ) {
                    ( token.permissions = this._buildUserPermissions( userId, token.user_permissions, token.permissions ) ), delete token.user_permissions;
                }
            }

            return tokens;
        }

        async removeUserToken ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.remove, [tokenId] );

            if ( !res.ok ) return res;

            if ( !res.rows ) return result( 404 );

            return result( 200 );
        }

        async setUserTokenEnabled ( tokenId, enabled, options = {} ) {
            const dbh = options.dbh || this.dbh;

            const res = await dbh.do( QUERIES.setEnabled, [enabled, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.rows ) {
                return res;
            }
            else {
                return result( 404 );
            }
        }

        async getUserTokenPermissions ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            const token = await dbh.selectRow( QUERIES.getUserTokenWithPermissons, [tokenId] );

            if ( !token.ok ) return token;

            if ( !token.data ) return result( 404 );

            const userPermissions = this._buildUserPermissions( token.data.user_id, token.data.user_permissions ),
                permissions = [];

            // token permissions is the user permissions, overridden with the custom token permissions
            for ( const id in userPermissions ) {
                permissions.push( {
                    id,
                    "enabled": userPermissions[id] && token.data.permissions[id],
                } );
            }

            this._addPermissionsMetadata( permissions );

            return result( 200, permissions );
        }

        async setUserTokenPermissions ( tokenId, permissions, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithPermissons, [tokenId] );

            // dbh error
            if ( !token.ok ) return token;

            // token not found
            if ( !token.data ) return result( 404 );

            // check, that token belongs to the user
            if ( options.userId && options.userId !== token.data.user_id ) return result( [404, `Token not found`] );

            const userPermissions = this._buildUserPermissions( token.data.user_id, token.data.user_permissions );

            // validate token permissions
            var res = this.#validateTokenPermissions( userPermissions, permissions );

            // permissions error
            if ( !res.ok ) return res;

            res = await dbh.do( QUERIES.update, [permissions, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.rows ) {
                return result( 200 );
            }
            else {
                return result( 404 );
            }
        }

        async updateUserTokenPermissions ( tokenId, permissions, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithPermissons, [tokenId] );

            // dbh error
            if ( !token.ok ) return token;

            // token not found
            if ( !token.data ) return result( 404 );

            // check, that token belongs to the user
            if ( options.userId && options.userId !== token.data.user_id ) return result( [404, `Token not found`] );

            const userPermissions = this._buildUserPermissions( token.data.user_id, token.data.user_permissions );

            // validate token permissions
            var res = this.#validateTokenPermissions( userPermissions, permissions );

            // permissions error
            if ( !res.ok ) return res;

            // merge token permissions
            permissions = {
                ...token.data.permissions,
                ...permissions,
            };

            res = await dbh.do( QUERIES.update, [permissions, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.rows ) {
                return result( 200 );
            }
            else {
                return result( 404 );
            }
        }

        #validateTokenPermissions ( userPermissions, tokenPermissions ) {
            for ( const name in tokenPermissions ) {

                // error, if user permission is not enabled
                if ( !userPermissions[name] ) return result( [400, `Token permission "${name}" is not valid`] );
            }

            return result( 200 );
        }
    };
