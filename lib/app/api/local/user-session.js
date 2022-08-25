import sql from "#lib/sql";
import Token from "../auth/token.js";
import constants from "#lib/app/constants";

const QUERIES = {
    "auth": sql`
        SELECT
            "user".id,
            "user".name,
            "user".roles,
            "user".gravatar
        FROM
            "user",
            user_session_key,
            user_session_key_hash
        WHERE
            "user".id = user_session_key.user_id
            AND user_session_key.id = user_session_key_hash.user_session_key_id
            AND "user".enabled = TRUE
            AND user_session_key.expires > CURRENT_TIMESTAMP
            AND user_session_key.id = ?
            AND user_session_key_hash.hash = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO user_session_key_hash ( user_session_key_id, hash ) VALUES ( ?, ? )`.prepare(),
    "insertToken": sql`INSERT INTO user_session_key ( user_id, expires, user_agent, ip_address ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "delete": sql`DELETE FROM user_session_key WHERE id = ?`.prepare(),
    "deleteSessions": sql`DELETE FROM user_session_key WHERE user_id = ? AND id != ?`.prepare(),
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
                "roles": this._buildUserRoles( user.data.id, user.data.roles ),
                "gravatar": user.data.gravatar,
            };
        }

        async createUserSession ( userId, userAgent, ipAddress, { dbh } = {} ) {
            dbh ||= this.dbh;

            var res = await dbh.begin( async dbh => {
                const expires = new Date( Date.now() + this.app.config.sessionMaxAge );

                // insert token
                let res = await dbh.selectRow( QUERIES.insertToken, [userId, expires, userAgent, ipAddress] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( constants.tokenTypeUserSession, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                return result( 200, {
                    "key": token.token,
                } );
            } );

            return res;
        }

        async deleteUserSession ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.delete, [tokenId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 204 );

            return result( 200 );
        }

        async deleteUserSessions ( userId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.deleteSessions, [userId, options.except] );

            return res;
        }
    };
