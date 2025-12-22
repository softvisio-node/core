import Token from "#lib/app/token";
import Interval from "#lib/interval";
import sql from "#lib/sql";

const SQL = {
    "deleteTokens": sql`DELETE FROM action_token WHERE user_id = ? AND type = ?`.prepare(),

    "insertToken": sql`INSERT INTO action_token ( user_id, type, expires, email_token, data ) VALUES ( ?, ?, ?, ?, ? ) RETURNING id, ( SELECT email FROM "user" WHERE id = user_id ) AS email`.prepare(),

    "insertHash": sql`INSERT INTO action_token_hash ( action_token_id, hash ) VALUES ( ?, ? )`.prepare(),

    "updatePublic": sql`UPDATE action_token SET public = ? WHERE id = ?`.prepare(),

    "getToken": sql`
SELECT
    action_token.id,
    action_token.type,
    action_token.public,
    action_token.user_id,
    action_token.email_token,
    action_token.data,
    action_token_hash.hash
FROM
    action_token,
    action_token_hash
WHERE
    action_token.id = action_token_hash.action_token_id
    AND action_token.id = ?
    AND action_token.expires > CURRENT_TIMESTAMP
`.prepare(),

    "setUserEmailConfirmed": sql`UPDATE "user" SET email_confirmed = TRUE WHERE id = ?`.prepare(),
};

export default class {
    #app;
    #config;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get config () {
        return this.#config;
    }

    // public
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async createActionToken ( userId, tokenType, { length, maxAge, emailToken = false, data, dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.begin( async dbh => {

            // delete tokens qith the same type
            let res = await dbh.do( SQL.deleteTokens, [ userId, tokenType ] );
            if ( !res.ok ) throw res;

            const expires = Interval.new( maxAge ).addDate();

            // insert token
            res = await dbh.selectRow( SQL.insertToken, [ userId, tokenType, expires, emailToken, data ] );
            if ( !res.ok ) throw res;

            const tokenId = res.data.id,
                email = res.data.email;

            // generate token
            const token = await Token.generate( this.app, tokenType, tokenId, { length } );

            // insert hash
            res = await dbh.do( SQL.insertHash, [ token.id, token.hash ] );
            if ( !res.ok ) throw res;

            // update public
            res = await dbh.do( SQL.updatePublic, [ token.public, token.id ] );
            if ( !res.ok ) throw res;

            return result( 200, {
                email,
                "token": token.token,
                expires,
            } );
        } );
    }

    async activateActionToken ( token, tokenType, { dbh } = {} ) {
        token = Token.new( this.app, token );

        // token is invalid
        if ( token.type !== tokenType ) return result( [ 400, "Token is invalid" ] );

        dbh ||= this.dbh;

        return dbh.begin( async dbh => {
            const res = await dbh.selectRow( SQL.getToken, [ token.id ] );
            if ( !res.ok ) throw res;

            // token not found
            if ( !res.data ) throw result( [ 400, "Token is invalid" ] );

            const token1 = new Token( this.app, res.data );

            // verify token
            if ( !token1.verify( token ) ) throw result( [ 400, "Token is invalid" ] );

            // set user email confirmed
            if ( res.data.email_token ) {
                const res1 = await dbh.do( SQL.setUserEmailConfirmed, [ token1.userId ] );
                if ( !res1.ok ) throw res1;
            }

            // delete user action token
            const res2 = await dbh.do( SQL.deleteTokens, [ token1.userId, token1.type ] );
            if ( !res2.ok ) throw res2;

            return result( 200, {
                "user_id": res.data.user_id,
                "data": res.data.data,
            } );
        } );
    }
}
