import "#index";

import sql from "#lib/sql";
import Token from "../../token.js";

import { AUTH_SESSION } from "#lib/const";

const QUERIES = {
    "auth": sql`
        SELECT
            "user"."id",
            "user"."name",
            "user"."permissions"
        FROM
            "user",
            "user_session",
            "user_session_hash"
        WHERE
            "user"."id" = "user_session"."user_id"
            AND "user_session"."id" = "user_session_hash"."user_session_id"
            AND "user"."enabled" = TRUE
            AND "user_session"."id" = ?
            AND "user_session_hash"."hash" = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO "user_session_hash" ("user_session_id", "hash") VALUES (?, ?)`.prepare(),
    "insertTokenPgsql": sql`INSERT INTO "user_session" ("user_id") VALUES (?) RETURNING "id"`.prepare(),
    "insertTokenSqlite": sql`INSERT INTO "user_session" ("user_id") VALUES (?)`.prepare(),
    "getIdSqlite": sql`SELECT "id" FROM "user_session" WHERE "rowid" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_session" WHERE "id" = ?`.prepare(),
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
            };
        }

        async createUserSession ( userId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.begin( async dbh => {
                let id;

                // insert token
                if ( dbh.isSqlite ) {
                    const res = await dbh.do( QUERIES.insertTokenSqlite, [userId] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = ( await dbh.selectRow( QUERIES.getIdSqlite, [dbh.lastInsertRowId] ) ).data.id;
                }
                else {
                    const res = await dbh.selectRow( QUERIES.insertTokenPgsql, [userId] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = res.data.id;
                }

                // generate token
                const token = Token.generate( AUTH_SESSION, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );

                if ( !res.ok || !res.rows ) throw result( 500 );

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

            if ( !res.rows ) return result( 204 );

            return result( 200 );
        }
    };
