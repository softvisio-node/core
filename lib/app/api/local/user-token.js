import sql from "#lib/sql";
import Base from "#lib/app/prototypes/base";
import Read from "#lib/app/prototypes/mixins/read";
import Token from "../auth/token.js";

import CONST from "#lib/const";

const QUERIES = {
    "auth": sql`
        SELECT
            "user"."id",
            "user"."name",
            "user"."permissions" AS "userPermissions",
            "userToken"."permissions" AS "tokenPermissions",
            "user"."gravatar"
        FROM
            "user",
            "userToken",
            "userTokenHash"
        WHERE
            "userToken"."userId" = "user"."id"
            AND "userToken"."id" = "userTokenHash"."userTokenId"
            AND "user"."enabled" = TRUE
            AND "userToken"."enabled" = TRUE
            AND "userToken"."id" = ?
            AND "userTokenHash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "userTokenHash" ("userTokenId", "hash") VALUES (?, ?)`.prepare(),
    "insertToken": sql`INSERT INTO "userToken" ("userId", "name", "enabled", "permissions" ) VALUES (?, ?, ?, ?) RETURNING "id"`.prepare(),
    "setEnabled": sql`UPDATE "userToken" SET "enabled" = ? WHERE "id" = ?`.prepare(),
    "update": sql`UPDATE "userToken" SET "permissions" = ? WHERE "id" = ?`.prepare(),
    "remove": sql`DELETE FROM "userToken" WHERE "id" = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM "userToken" WHERE "id" = ?`.prepare(),
    "getUserTokenWithPermissons": sql`SELECT "userToken".*, "user"."permissions" AS "userPermissions" FROM "userToken", "user" WHERE "userToken"."id" = ? AND "userToken"."userId" = "user"."id"`.prepare(),
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
                "permissions": this._buildUserPermissions( res.data.id, res.data.userPermissions, res.data.tokenPermissions ),
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

                // insert token
                let res = await dbh.selectRow( QUERIES.insertToken, [userId, name, enabled, permissions] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( CONST.AUTH_TOKEN, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

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

            token.data.permissions = this._buildUserPermissions( token.data.userId, token.data.userPermissions, token.data.permissions );

            delete token.data.userPermissions;

            return token;
        }

        async getUserTokens ( userId, options, ctx ) {
            if ( !this.#read ) {
                this.#read = new ( Read( Base ) )( this );
            }

            var where = this.dbh.where( sql`"userToken"."userId" = "user"."id" AND "user"."id" = ${userId}` );

            // get by id
            if ( options.id ) {
                where.and( sql`"userToken"."id" = ${options.id}` );
            }

            // get all matched rows
            else {

                // filter search
                if ( options.where && options.where.search ) {
                    where.and( { "userToken.name": options.where.search } );

                    delete options.where.search;
                }
            }

            const totalQuery = sql`SELECT count(*) AS "total" FROM "userToken", "user"`.WHERE( where );

            const mainQuery = sql`SELECT "userToken".*, "user"."permissions" AS "userPermissions" FROM "userToken", "user"`.WHERE( where );

            var tokens = await this.#read._read( ctx, totalQuery, mainQuery, options );

            if ( tokens.data ) {
                for ( const token of tokens.data ) {
                    token.permissions = this._buildUserPermissions( userId, token.userPermissions, token.permissions );

                    delete token.userPermissions;
                }
            }

            return tokens;
        }

        async removeUserToken ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.remove, [tokenId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return result( 200 );
        }

        async setUserTokenEnabled ( tokenId, enabled, options = {} ) {
            const dbh = options.dbh || this.dbh;

            const res = await dbh.do( QUERIES.setEnabled, [enabled, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
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

            const userPermissions = this._buildUserPermissions( token.data.userId, token.data.userPermissions ),
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
            if ( options.userId && options.userId !== token.data.userId ) return result( [404, `Token not found`] );

            const userPermissions = this._buildUserPermissions( token.data.userId, token.data.userPermissions );

            // validate token permissions
            var res = this.#validateTokenPermissions( userPermissions, permissions );

            // permissions error
            if ( !res.ok ) return res;

            res = await dbh.do( QUERIES.update, [permissions, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
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
            if ( options.userId && options.userId !== token.data.userId ) return result( [404, `Token not found`] );

            const userPermissions = this._buildUserPermissions( token.data.userId, token.data.userPermissions );

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
            else if ( res.meta.rows ) {
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
