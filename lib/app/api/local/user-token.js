import sql from "#lib/sql";
import Base from "#lib/app/prototypes/base";
import Read from "#lib/app/prototypes/mixins/read";
import Token from "../auth/token.js";
import constants from "#lib/app/constants";

const QUERIES = {
    "auth": sql`
        SELECT
            "user".id,
            "user".name,
            "user".roles AS user_roles,
            user_token.roles AS token_roles,
            "user".gravatar
        FROM
            "user",
            user_token,
            user_token_hash
        WHERE
            user_token.user_id = "user".id
            AND user_token.id = user_token_hash.user_token_id
            AND "user".enabled = TRUE
            AND user_token.enabled = TRUE
            AND user_token.id = ?
            AND user_token_hash.hash = ?
    `.prepare(),
    "storeHash": sql`INSERT INTO user_token_hash ( user_token_id, hash ) VALUES ( ?, ? )`.prepare(),
    "insertToken": sql`INSERT INTO user_token ( user_id, name, enabled, roles ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "setEnabled": sql`UPDATE user_token SET enabled = ? WHERE id = ?`.prepare(),
    "update": sql`UPDATE user_token SET roles = ? WHERE id = ?`.prepare(),
    "remove": sql`DELETE FROM user_token WHERE id = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM user_token WHERE id = ?`.prepare(),
    "getUserTokenWithRoles": sql`SELECT user_token.*, "user".roles AS user_roles FROM user_token, "user" WHERE user_token.id = ? AND user_token.user_id = "user".id`.prepare(),
};

export default Super =>
    class extends ( Super || Object ) {
        #read;

        async _authenticateUserToken ( token ) {
            var res = await this.dbh.selectRow( QUERIES.auth, [token.id, token.hash] );

            // token not found, user disabled, token disabled or hash is invalid
            if ( !res.data ) return;

            return {
                "userId": res.data.id,
                "username": res.data.name,
                "roles": this._buildUserRoles( res.data.id, res.data.user_roles, res.data.token_roles ),
                "gravatar": res.data.gravatar,
            };
        }

        async createUserToken ( userId, name, enabled, roles = {}, options = {} ) {
            const dbh = options.dbh || this.dbh;

            // resolve user
            var user = await this._getUser( userId, { dbh } );

            // user error
            if ( !user.ok ) return user;

            // validate token roles
            var res = this.#validateTokenRoles( user.data.roles, roles );

            // roles error
            if ( !res.ok ) return res;

            // start transaction
            res = await dbh.begin( async dbh => {

                // insert token
                let res = await dbh.selectRow( QUERIES.insertToken, [userId, name, enabled, roles] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                const id = res.data.id;

                // generate token
                const token = Token.generate( constants.tokenTypeUserToken, id );

                // insert hash
                res = await dbh.do( QUERIES.storeHash, [token.id, token.hash] );
                if ( !res.ok || !res.meta.rows ) throw result( 500 );

                return result( 200, {
                    "id": token.id,
                    "token": token.token,
                    "userId": userId,
                    "username": user.data.name,
                    "roles": this._buildUserRoles( userId, user.data.roles, roles ),
                } );
            } );

            return res;
        }

        async getUserToken ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

            if ( !token.ok ) return token;

            if ( !token.data ) return result( 404 );

            token.data.roles = this._buildUserRoles( token.data.user_id, token.data.user_roles, token.data.roles );

            delete token.data.user_roles;

            return token;
        }

        async getUserTokens ( userId, options, ctx ) {
            if ( !this.#read ) {
                this.#read = new ( Read( Base ) )( this );
            }

            var where = this.dbh.where( sql`"user_token"."user_id" = "user"."id" AND "user"."id" = ${userId}` );

            // get by id
            if ( options.id ) {
                where.and( sql`"user_token"."id" = ${options.id}` );
            }

            // get all matched rows
            else {

                // filter search
                if ( options.where && options.where.name ) {
                    where.and( { "user_token.name": options.where.name } );
                }
            }

            const mainQuery = sql`SELECT user_token.*, "user".roles AS user_roles FROM user_token, "user"`.WHERE( where );

            var tokens = await this.#read._read( ctx, mainQuery, { options } );

            if ( tokens.data ) {
                for ( const token of tokens.data ) {
                    token.roles = this._buildUserRoles( userId, token.user_roles, token.roles );

                    delete token.user_roles;
                }
            }

            return tokens;
        }

        async removeUserToken ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var res = await dbh.do( QUERIES.remove, [tokenId] );

            if ( !res.ok ) return res;

            if ( !res.meta.rows ) return result( 404 );

            return result( 200 );
        }

        async setUserTokenEnabled ( tokenId, enabled, options = {} ) {
            const dbh = options.dbh || this.dbh;

            const res = await dbh.do( QUERIES.setEnabled, [enabled, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                return res;
            }
            else {
                return result( 404 );
            }
        }

        async getUserTokenRoles ( tokenId, options = {} ) {
            const dbh = options.dbh || this.dbh;

            const token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

            if ( !token.ok ) return token;

            if ( !token.data ) return result( 404 );

            const userRoles = this._buildUserRoles( token.data.user_id, token.data.user_roles ),
                roles = [];

            // token roles is the user roles, overridden with the custom token roles
            for ( const id in userRoles ) {
                roles.push( {
                    id,
                    "enabled": userRoles[id] && token.data.roles[id],
                } );
            }

            this._addRolesMetadata( roles );

            return result( 200, roles );
        }

        async setUserTokenRoles ( tokenId, roles, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

            // dbh error
            if ( !token.ok ) return token;

            // token not found
            if ( !token.data ) return result( 404 );

            // check, that token belongs to the user
            if ( options.userId && options.userId !== token.data.user_id ) return result( [404, `Token not found`] );

            const userRoles = this._buildUserRoles( token.data.user_id, token.data.user_roles );

            // validate token roles
            var res = this.#validateTokenRoles( userRoles, roles );

            // roles error
            if ( !res.ok ) return res;

            res = await dbh.do( QUERIES.update, [roles, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                return result( 200 );
            }
            else {
                return result( 404 );
            }
        }

        async updateUserTokenRoles ( tokenId, roles, options = {} ) {
            const dbh = options.dbh || this.dbh;

            var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

            // dbh error
            if ( !token.ok ) return token;

            // token not found
            if ( !token.data ) return result( 404 );

            // check, that token belongs to the user
            if ( options.userId && options.userId !== token.data.user_id ) return result( [404, `Token not found`] );

            const userRoles = this._buildUserRoles( token.data.user_id, token.data.user_roles );

            // validate token roles
            var res = this.#validateTokenRoles( userRoles, roles );

            // roles error
            if ( !res.ok ) return res;

            // merge token roles
            roles = {
                ...token.data.roles,
                ...roles,
            };

            res = await dbh.do( QUERIES.update, [roles, tokenId] );

            if ( !res.ok ) {
                return res;
            }
            else if ( res.meta.rows ) {
                return result( 200 );
            }
            else {
                return result( 404 );
            }
        }

        #validateTokenRoles ( userRoles, tokenRoles ) {
            for ( const name in tokenRoles ) {

                // error, if user role is not enabled
                if ( !userRoles[name] ) return result( [400, `Token role "${name}" is not valid`] );
            }

            return result( 200 );
        }
    };
