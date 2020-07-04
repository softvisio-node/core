const { mixin } = require( "../../../mixins" );
const result = require( "../../../result" );
const { TOKEN_TYPE_EMAIL_CONFIRM, TOKEN_TYPE_PASSWORD_RESET } = require( "../../../const" );
const sql = require( "../../../sql" );

const q = {
    "get": sql`SELECT "id", "email", "email_confirmed" FROM "user" WHERE "enabled" = TRUE AND ("name" = ? OR "email" = ?)`.prepare(),
    "insertHash": sql`INSERT INTO "auth_hash" ("id", "hash") VALUES (?, ?)`.prepare(),
    "insertToken": sql`INSERT INTO "user_action_token" ("id", "user_id", "type", "email") VALUES (?, ?, ?, ?)`.prepare(),
    "verify": sql`SELECT "user_action_token".*, "auth_hash"."hash" FROM "user_action_token", "auth_hash" WHERE "user_action_token"."id" = "auth_hash"."id" AND "user_action_token"."id" = ?`.prepare(),
    "remove": sql`DELETE FROM "user_action_token" WHERE "type" = ? AND email = ?`.prepare(),
    "setEmailConfirmed": sql`UPDATE "user" SET "email_confirmed" = TRUE WHERE "id" = ?`.prepare(),
};

module.exports = mixin( ( Super ) =>
    class extends Super {
            #dbh;

            constructor ( app, dbh ) {
                super( app, dbh );

                this.#dbh = dbh;
            }

            async createUserActionToken ( userId, tokenType ) {

                // lowercase user id
                userId = userId.toLowerCase();

                var user = await this.#dbh.selectRow( q.get, [userId, userId] );

                if ( !user.ok ) return user;

                if ( !user.data || !user.data.email ) return result( 404, "Email not found" );

                // user email is already confirmed
                if ( tokenType === TOKEN_TYPE_EMAIL_CONFIRM && user.data.email_confirmed ) return result( 400, "User email already confirmed" );

                var token = this._generateToken( tokenType );

                var res = await this.#dbh.begin( async ( dbh ) => {

                    // insert hash
                    var res = await dbh.do( q.insertHash, [token.id, token.hash] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    res = await dbh.do( q.insertToken, [token.id, user.data.id, token.type, user.data.email] );

                    if ( !res.ok || !res.rows ) throw result( 500 );

                    return result( 200, {
                        "email": user.data.email,
                        "token": token.token,
                        "type": token.type,
                    } );
                } );

                return res;
            }

            async verifyUserActionToken ( token, tokenType ) {
                var privateToken = this._unpackToken( token );

                // unable to unpack token
                if ( !privateToken || privateToken.type !== tokenType ) return result( [400, "Token is invalid"] );

                var res = await this.#dbh.selectRow( q.verify, [privateToken.id] );

                if ( !res.ok ) return res;

                if ( !res.data ) return result( [404, "Token not found"] );

                // token is not match
                if ( privateToken.hash !== res.data.hash ) return result( [400, "Token is invalid"] );

                return result( 200, {
                    "userId": res.data.user_id,
                    "email": res.data.email,
                } );
            }

            async removeUserActionTokens ( tokenType, email, dbh ) {
                if ( !dbh ) dbh = this.#dbh;

                return dbh.do( q.remove, [tokenType, email] );
            }

            async confirmUserActionTokenEmail ( token ) {

                // verify token
                token = await this.verifyUserActionToken( token, TOKEN_TYPE_EMAIL_CONFIRM );

                if ( !token.ok ) return token;

                return await this.#dbh.begin( async ( dbh ) => {

                    // remove all email confirmation tokens
                    var res = await this.removeUserActionTokens( TOKEN_TYPE_EMAIL_CONFIRM, token.data.email, dbh );

                    if ( !res.ok ) throw res;

                    // set email confirmed
                    res = await dbh.do( q.setEmailConfirmed, [token.data.userId] );

                    if ( !res.ok ) throw res;

                    return res;
                } );
            }

            async setUserActionTokenPassword ( token, password ) {

                // verify token
                token = await this.verifyUserActionToken( token, TOKEN_TYPE_PASSWORD_RESET );

                if ( !token.ok ) return token;

                return await this.#dbh.begin( async ( dbh ) => {

                    // set new user password
                    var res = await this.setUserPassword( token.data.userId, password, dbh );

                    if ( !res.ok ) throw res;

                    // remove all reset password tokens
                    res = await this.removeUserActionTokens( TOKEN_TYPE_PASSWORD_RESET, token.data.email, dbh );

                    if ( !res.ok ) throw res;

                    // remove all email confirmation tokens
                    res = await this.removeUserActionTokens( TOKEN_TYPE_EMAIL_CONFIRM, token.data.email, dbh );

                    if ( !res.ok ) throw res;

                    // set email confirmed
                    res = await dbh.do( q.setEmailConfirmed, [token.data.userId] );

                    if ( !res.ok ) throw res;

                    return res;
                } );
            }
    } );
