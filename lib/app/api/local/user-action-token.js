const result = require( "../../../result" );
const sql = require( "../../../sql" );
const Token = require( "../../token" );

const CONST = require( "../../../const" );

const QUERIES = {
    "get": sql`SELECT "id", "email", "email_confirmed" FROM "user" WHERE "enabled" = TRUE AND ("name" = ? OR "email" = ?)`.prepare(),
    "insertHash": sql`INSERT INTO "user_action_token_hash" ("user_action_token_id", "hash") VALUES (?, ?)`.prepare(),
    "insertTokenPgsql": sql`INSERT INTO "user_action_token" ("user_id", "type", "email") VALUES (?, ?, ?) RETURNING "id"`.prepare(),
    "insertTokenSqlite": sql`INSERT INTO "user_action_token" ("user_id", "type", "email") VALUES (?, ?, ?)`.prepare(),
    "getIdSqlite": sql`SELECT "id" FROM "user_action_token" WHERE "rowid" = ?`.prepare(),
    "verify": sql`SELECT "user_action_token".*, "user_action_token_hash"."hash" FROM "user_action_token", "user_action_token_hash" WHERE "user_action_token"."id" = "user_action_token_hash"."user_action_token_id" AND "user_action_token"."id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_action_token" WHERE "type" = ? AND email = ?`.prepare(),
    "setEmailConfirmed": sql`UPDATE "user" SET "email_confirmed" = TRUE WHERE "id" = ?`.prepare(),
};

module.exports = Super =>
    class extends Super {
        async createUserActionToken ( userId, tokenType, options = {} ) {
            const dbh = options.dbh || this.dbh;

            // lowercase user id
            userId = userId.toLowerCase();

            var user = await dbh.selectRow( QUERIES.get, [userId, userId] );

            if ( !user.ok ) return user;

            if ( !user.data || !user.data.email ) return result( 404, "Email not found" );

            // user email is already confirmed
            if ( tokenType === CONST.AUTH_EMAIL_CONFIRM && user.data.email_confirmed ) return result( 400, "User email already confirmed" );

            var res = await dbh.begin( async dbh => {
                let id;

                // insert token
                if ( dbh.isSqlite ) {
                    const res = await dbh.do( QUERIES.insertTokenSqlite, [user.data.id, tokenType, user.data.email] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = ( await dbh.selectRow( QUERIES.getIdSqlite, [dbh.lastInsertRowId] ) ).data.id;
                }
                else {
                    const res = await dbh.selectRow( QUERIES.insertTokenPgsql, [user.data.id, tokenType, user.data.email] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    id = res.data.id;
                }

                // generate token
                const token = Token.generateToken( tokenType, id );

                // insert hash
                var res = await dbh.do( QUERIES.insertHash, [token.id, token.hash] );

                if ( !res.ok || !res.rows ) throw result( 500 );

                return result( 200, {
                    "email": user.data.email,
                    "token": token.token,
                    "type": token.type,
                } );
            } );

            return res;
        }

        async verifyUserActionToken ( token, tokenType, options = {} ) {
            const dbh = options.dbh || this.dbh;

            token = Token.createToken( token );

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

        async removeUserActionTokens ( tokenType, email, options = {} ) {
            const dbh = options.dbh || this.dbh;

            return dbh.do( QUERIES.remove, [tokenType, email] );
        }

        async confirmUserActionTokenEmail ( token, options = {} ) {
            const dbh = options.dbh || this.dbh;

            // verify token
            token = await this.verifyUserActionToken( token, CONST.AUTH_EMAIL_CONFIRM, { dbh } );

            if ( !token.ok ) return token;

            return await dbh.begin( async dbh => {

                // remove all email confirmation tokens
                var res = await this.removeUserActionTokens( CONST.AUTH_EMAIL_CONFIRM, token.data.email, { dbh } );

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
            token = await this.verifyUserActionToken( token, CONST.AUTH_PASSWORD_RESET, { dbh } );

            if ( !token.ok ) return token;

            return await dbh.begin( async dbh => {

                // set new user password
                var res = await this.setUserPassword( token.data.userId, password, { dbh } );

                if ( !res.ok ) throw res;

                // remove all reset password tokens
                res = await this.removeUserActionTokens( CONST.AUTH_PASSWORD_RESET, token.data.email, { dbh } );

                if ( !res.ok ) throw res;

                // remove all email confirmation tokens
                res = await this.removeUserActionTokens( CONST.AUTH_EMAIL_CONFIRM, token.data.email, { dbh } );

                if ( !res.ok ) throw res;

                // set email confirmed
                res = await dbh.do( QUERIES.setEmailConfirmed, [token.data.userId] );

                if ( !res.ok ) throw res;

                return res;
            } );
        }
    };
