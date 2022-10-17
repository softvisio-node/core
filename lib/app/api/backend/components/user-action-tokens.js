import Component from "#lib/app/api/backend/component";
import sql from "#lib/sql";
import Token from "#lib/app/api/auth/token";

const QUERIES = {
    "deleteTokens": sql`DELETE FROM user_action_token WHERE user_id = ? AND type = ?`.prepare(),

    "insertToken": sql`INSERT INTO user_action_token ( user_id, type, expires, data ) VALUES ( ?, ?, ?, ? ) RETURNING id, ( SELECT email FROM "user" WHERE id = user_id ) AS email`.prepare(),

    "insertHash": sql`INSERT INTO user_action_token_hash ( user_action_token_id, hash ) VALUES ( ?, ? )`.prepare(),

    "getToken": sql`
SELECT
    user_action_token.user_id,
    user_action_token.data
FROM
    user_action_token,
    user_action_token_hash
WHERE
    user_action_token.id = user_action_token_hash.user_action_token_id
    AND user_action_token.id = ?
    AND user_action_token.expires > CURRENT_TIMESTAMP
    AND user_action_token_hash.hash = ?
`.prepare(),

    "setUserEmailConfirmed": sql`UPDATE "user" SET email_confirmed = TRUE WHERE id = ?`.prepare(),
};

export default class extends Component {

    // public
    async createUserActionToken ( userId, tokenType, { data, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.begin( async dbh => {

            // delete tokens of the same type
            let res = await dbh.do( QUERIES.deleteTokens, [userId, tokenType] );
            if ( !res.ok ) throw res;

            const expires = new Date( Date.now() + this.api.config.actionTokenMaxAge );

            // insert token
            res = await dbh.selectRow( QUERIES.insertToken, [userId, tokenType, expires, data] );
            if ( !res.ok ) throw res;

            const tokenId = res.data.id,
                email = res.data.email;

            // generate token
            const token = Token.generate( tokenType, tokenId, { "length": 16 } );

            // insert hash
            res = await dbh.do( QUERIES.insertHash, [token.id, token.hash] );
            if ( !res.ok ) throw res;

            return result( 200, {
                email,
                "token": token.token,
                expires,
            } );
        } );
    }

    async activateUserActionToken ( token, tokenType, { userId, dbh } = {} ) {
        dbh ||= this.dbh;

        token = Token.new( token );

        // token is invalid
        if ( !token || token.type !== tokenType ) return result( [400, "Token is invalid"] );

        return dbh.begin( async dbh => {
            const res = await dbh.selectRow( QUERIES.getToken, [token.id, token.hash] );
            if ( !res.ok ) throw res;
            if ( !res.data ) throw result( [400, "Token is invalid"] );
            if ( userId && res.data.user_id !== userId ) throw result( [400, "Token is invalid"] );

            const res1 = await dbh.do( QUERIES.setUserEmailConfirmed, [res.data.user_id] );
            if ( !res1.ok ) throw res1;

            const res3 = await dbh.do( QUERIES.deleteTokens, [res.data.user_id, tokenType] );
            if ( !res3.ok ) throw res3;

            return result( 200, res.data.data );
        } );
    }
}
