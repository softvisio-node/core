import sql from "#lib/sql";
import Token from "../auth/token.js";

import CONST from "#lib/const";

const QUERIES = {
    "auth": sql`
        SELECT
            "user"."id",
            "user"."name",
            "user"."permissions",
            "user"."gravatar"
        FROM
            "user",
            "userSession",
            "userSessionHash"
        WHERE
            "user"."id" = "userSession"."userId"
            AND "userSession"."id" = "userSessionHash"."userSessionId"
            AND "user"."enabled" = TRUE
            AND "userSession"."id" = ?
            AND "userSessionHash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "userSessionHash" ("userSessionId", "hash") VALUES (?, ?)`.prepare(),
    "insertToken": sql`INSERT INTO "userSession" ("userId") VALUES (?) RETURNING "id"`.prepare(),
    "remove": sql`DELETE FROM "userSession" WHERE "id" = ?`.prepare(),
    "removeSessions": sql`DELETE FROM "userSession" WHERE "userId" = ? AND "id" != ?`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        async _authenticateUserSession ( token ) {
            var user = await this.dbh.selectRow( QUERIES.auth, [token.id, token.hash] );

            // user not found or disabled
            if ( !user.data ) return;

            return {
                "userId": user.data.id,
                "username": user.data.name,
                "permissions": this._buildUserPermissions( user.data.id, user.data.permissions ),
                "gravatar": user.data.gravatar,
            };
        }

        async createUserSession ( userId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.begin( async dbh => {

                // insert token
                let res = await dbh.selectRow( QUERIES.insertToken, [userId] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( CONST.AUTH_SESSION, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                return result( 200, {
                    "token": token.token,
                } );
            } );

            return res;
        }

        async removeUserSession ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.remove, [tokenId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 204 );

            return result( 200 );
        }

        async removeUserSessions ( userId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.removeSessions, [userId, options.except] );

            return res;
        }
    };
