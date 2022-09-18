import sql from "#lib/sql";
import Token from "../auth/token.js";
import constants from "#lib/app/constants";

const QUERIES = {
    "deleteTokens": sql`DELETE FROM user_action_token WHERE user_id = ? AND type = ?`.prepare(),

    "insertToken": sql`INSERT INTO user_action_token ( user_id, type, expires, data ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),

    "getUser": sql`SELECT id, email, email_confirmed FROM "user" WHERE enabled = TRUE AND email = ?`.prepare(),
    "insertHash": sql`INSERT INTO user_action_token_hash ( user_action_token_id, hash ) VALUES ( ?, ? )`.prepare(),
    "verify": sql`SELECT user_action_token.*, user_action_token_hash.hash FROM user_action_token, user_action_token_hash WHERE user_action_token.id = user_action_token_hash.user_action_token_id AND user_action_token.id = ? AND user_action_token.expires > CURRENT_TIMESTAMP`.prepare(),
    "delete": sql`DELETE FROM user_action_token WHERE type = ? AND email = ?`.prepare(),
    "setEmailConfirmed": sql`UPDATE "user" SET email_confirmed = TRUE WHERE id = ?`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {

        // public
        async createUserActionToken ( userId, tokenType, { data, dbh } = {} ) {
            dbh ||= this.dbh;

            return dbh.begin( async dbh => {

                // delete tokens of the same type
                let res = await dbh.do( QUERIES.deleteTokens, [userId, tokenType] );
                if ( !res.ok ) throw res;

                const expires = new Date( Date.now() + this.app.config.actionTokenMaxAge );

                // insert token
                res = await dbh.selectRow( QUERIES.insertToken, [userId, tokenType, expires, data] );
                if ( !res.ok ) throw res;

                const tokenId = res.data.id;

                // generate token
                const token = Token.generate( tokenType, tokenId );

                // insert hash
                res = await dbh.do( QUERIES.insertHash, [token.id, token.hash] );
                if ( !res.ok ) throw res;

                return result( 200, {
                    "token": token.token,
                    expires,
                } );
            } );
        }

        // XXX confirm user email
        async verifyUserActionToken ( token, tokenType, { dbh } = {} ) {
            dbh ||= this.dbh;

            token = Token.new( token );

            // unable to unpack token
            if ( !token || token.type !== tokenType ) return result( [400, "Token is invalid"] );

            var res = await dbh.selectRow( QUERIES.verify, [token.id] );

            if ( !res.ok ) return res;

            if ( !res.data ) return result( [404, "Token not found"] );

            // token is not match
            if ( token.hash !== res.data.hash ) return result( [400, "Token is invalid"] );

            return result( 200, {
                "userId": res.data.user_id,
                "email": res.data.email,
            } );
        }

        async deleteUserActionTokens ( tokenType, email, { dbh } = {} ) {
            dbh ||= this.dbh;

            return dbh.do( QUERIES.delete, [tokenType, email] );
        }

        async confirmUserActionTokenEmail ( token, { dbh } = {} ) {
            dbh ||= this.dbh;

            // verify token
            token = await this.verifyUserActionToken( token, constants.tokenTypeEmailConfirmation, { dbh } );

            if ( !token.ok ) return token;

            return await dbh.begin( async dbh => {

                // delete all email confirmation tokens
                var res = await this.deleteUserActionTokens( constants.tokenTypeEmailConfirmation, token.data.email, { dbh } );

                if ( !res.ok ) throw res;

                // set email confirmed
                res = await dbh.do( QUERIES.setEmailConfirmed, [token.data.userId] );

                if ( !res.ok ) throw res;

                return res;
            } );
        }

        async setUserActionTokenPassword ( token, password, { dbh } = {} ) {
            dbh ||= this.dbh;

            // verify token
            token = await this.verifyUserActionToken( token, constants.tokenTypePasswordReset, { dbh } );

            if ( !token.ok ) return token;

            return await dbh.begin( async dbh => {

                // set new user password
                var res = await this.setUserPassword( token.data.userId, password, { dbh } );

                if ( !res.ok ) throw res;

                // delete all reset password tokens
                res = await this.deleteUserActionTokens( constants.tokenTypePasswordReset, token.data.email, { dbh } );

                if ( !res.ok ) throw res;

                // delete all email confirmation tokens
                res = await this.deleteUserActionTokens( constants.tokenTypeEmailConfirmation, token.data.email, { dbh } );

                if ( !res.ok ) throw res;

                // set email confirmed
                res = await dbh.do( QUERIES.setEmailConfirmed, [token.data.userId] );

                if ( !res.ok ) throw res;

                return res;
            } );
        }
    };
