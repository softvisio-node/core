import sql from "#lib/sql";
import Token from "../auth/token.js";
import constants from "#lib/app/constants";

const QUERIES = {
    "get": sql`SELECT id, email, email_confirmed FROM "user" WHERE enabled = TRUE AND ( name = ? OR email = ? )`.prepare(),
    "insertHash": sql`INSERT INTO user_action_token_hash ( user_action_token_id, hash ) VALUES ( ?, ? )`.prepare(),
    "insertToken": sql`INSERT INTO user_action_token ( user_id, type, email, expires ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "verify": sql`SELECT user_action_token.*, user_action_token_hash.hash FROM user_action_token, user_action_token_hash WHERE user_action_token.id = user_action_token_hash.user_action_token_id AND user_action_token.id = ? AND user_action_token.expires > CURRENT_TIMESTAMP`.prepare(),
    "delete": sql`DELETE FROM user_action_token WHERE type = ? AND email = ?`.prepare(),
    "setEmailConfirmed": sql`UPDATE "user" SET email_confirmed = TRUE WHERE id = ?`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {

        // public
        async createUserActionToken ( userId, tokenType, options = {} ) {
            const dbh = options.dbh || this.dbh;

            // lowercase user id
            userId = userId.toLowerCase();

            var user = await dbh.selectRow( QUERIES.get, [userId, userId] );

            if ( !user.ok ) return user;

            if ( !user.data || !user.data.email ) return result( 404, "Email not found" );

            // user email is already confirmed
            if ( tokenType === constants.tokenTypeEmailConfirmation && user.data.email_confirmed ) return result( 400, "User email already confirmed" );

            var res = await dbh.begin( async dbh => {
                const expires = new Date( Date.now() + this.app.config.tokenMaxAge );

                // insert token
                let res = await dbh.selectRow( QUERIES.insertToken, [user.data.id, tokenType, user.data.email, expires] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( tokenType, id );

                // insert hash
                res = await dbh.do( QUERIES.insertHash, [token.id, token.hash] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                return result( 200, {
                    "email": user.data.email,
                    "token": token.token,
                    "type": token.type,
                    expires,
                } );
            } );

            return res;
        }

        async verifyUserActionToken ( token, tokenType, options = {} ) {
            const dbh = options.dbh || this.dbh;

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

        async deleteUserActionTokens ( tokenType, email, options = {} ) {
            const dbh = options.dbh || this.dbh;

            return dbh.do( QUERIES.delete, [tokenType, email] );
        }

        async confirmUserActionTokenEmail ( token, options = {} ) {
            const dbh = options.dbh || this.dbh;

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

        async setUserActionTokenPassword ( token, password, options = {} ) {
            const dbh = options.dbh || this.dbh;

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
