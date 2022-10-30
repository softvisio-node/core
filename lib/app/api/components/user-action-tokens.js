import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Token from "#lib/app/api/token";

const QUERIES = {
    "deleteTokens": sql`DELETE FROM user_action_token WHERE user_id = ? AND type = ?`.prepare(),

    "insertToken": sql`INSERT INTO user_action_token ( user_id, type, expires, data ) VALUES ( ?, ?, ?, ? ) RETURNING id, ( SELECT email FROM "user" WHERE id = user_id ) AS email`.prepare(),

    "insertHash": sql`INSERT INTO user_action_token_hash ( user_action_token_id, fingerprint, hash ) VALUES ( ?, ?, ? )`.prepare(),

    "getToken": sql`
SELECT
    user_action_token.id,
    user_action_token.type,
    user_action_token.user_id,
    user_action_token.data,
    user_action_token_hash.fingerprint,
    user_action_token_hash.hash
FROM
    user_action_token,
    user_action_token_hash
WHERE
    user_action_token.id = user_action_token_hash.user_action_token_id
    AND user_action_token.id = ?
    AND user_action_token.expires > CURRENT_TIMESTAMP
`.prepare(),

    "setUserEmailConfirmed": sql`UPDATE "user" SET email_confirmed = TRUE WHERE id = ?`.prepare(),
};

export default class extends Component {

    // public
    async createUserActionToken ( userId, tokenType, { data, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.begin( async dbh => {

            // delete tokens qith the same type
            let res = await dbh.do( QUERIES.deleteTokens, [userId, tokenType] );
            if ( !res.ok ) throw res;

            const expires = new Date( Date.now() + this.api.config.actionTokenMaxAge );

            // insert token
            res = await dbh.selectRow( QUERIES.insertToken, [userId, tokenType, expires, data] );
            if ( !res.ok ) throw res;

            const tokenId = res.data.id,
                email = res.data.email;

            // generate token
            const token = Token.generate( this.api, tokenType, tokenId );

            // insert hash
            res = await dbh.do( QUERIES.insertHash, [token.id, token.fingerprint, await token.getHash()] );
            if ( !res.ok ) throw res;

            return result( 200, {
                email,
                "token": token.token,
                expires,
            } );
        } );
    }

    async activateUserActionToken ( token, tokenType, { userId, dbh } = {} ) {
        token = Token.new( this.api, token );

        // token is invalid
        if ( token.type !== tokenType ) return result( [400, "Token is invalid"] );

        dbh ||= this.dbh;

        return dbh.begin( async dbh => {
            const res = await dbh.selectRow( QUERIES.getToken, [token.id] );
            if ( !res.ok ) throw res;

            // token not found
            if ( !res.data ) throw result( [400, "Token is invalid"] );

            const token1 = new Token( this.api, res.data );

            // invalid user id
            if ( userId && token1.userId !== userId ) throw result( [400, "Token is invalid"] );

            // verify token
            if ( !( await token1.verify( token ) ) ) throw result( [400, "Token is invalid"] );

            // set user email confirmed
            const res1 = await dbh.do( QUERIES.setUserEmailConfirmed, [token1.userId] );
            if ( !res1.ok ) throw res1;

            // delete user action token
            const res2 = await dbh.do( QUERIES.deleteTokens, [token1.userId, token1.type] );
            if ( !res2.ok ) throw res2;

            return result( 200, res.data.data );
        } );
    }
}
