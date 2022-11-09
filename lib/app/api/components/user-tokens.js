import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Base from "#lib/app/api/frontend/schema/base";
import Read from "#lib/app/mixins/read";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";

const QUERIES = {
    "storeHash": sql`INSERT INTO user_token_hash ( user_token_id, fingerprint, hash ) VALUES ( ?, ?, ? )`.prepare(),
    "insertToken": sql`INSERT INTO user_token ( user_id, name, enabled, roles ) VALUES ( ?, ?, ?, ? ) RETURNING id`.prepare(),
    "setEnabled": sql`UPDATE user_token SET enabled = ? WHERE id = ?`.prepare(),
    "update": sql`UPDATE user_token SET roles = ? WHERE id = ?`.prepare(),
    "delete": sql`DELETE FROM user_token WHERE id = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM user_token WHERE id = ?`.prepare(),
    "getUserTokenWithRoles": sql`SELECT user_token.*, "user".roles AS user_roles FROM user_token, "user" WHERE user_token.id = ? AND user_token.user_id = "user".id`.prepare(),
};

export default class extends Component {
    #read;

    // public
    // XXX remove roles
    async createUserToken ( userId, name, enabled, roles = {}, options = {} ) {
        const dbh = options.dbh || this.dbh;

        // resolve user
        // var user = await this.api.user.getUser( userId, { dbh } );

        // user error
        // if ( !user.ok ) return user;

        // validate token roles
        // var res = this.#validateTokenRoles( user.data.roles, roles );

        // roles error
        // if ( !res.ok ) return res;

        // start transaction
        var res = await dbh.begin( async dbh => {

            // insert token
            let res = await dbh.selectRow( QUERIES.insertToken, [userId, name, enabled, roles] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            const id = res.data.id;

            // generate token
            const token = Token.generate( this.api, constants.tokenTypeUserToken, id, { "length": this.api.config.userTokenLength } );

            // insert hash
            res = await dbh.do( QUERIES.storeHash, [token.id, token.fingerprint, await token.getHash()] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            return result( 200, {
                "id": token.id,
                "token": token.token,
                "userId": userId,

                // "email": user.data.email,
                // "roles": this.api.userRoles.buildUserRoles( userId, user.data.roles, roles ),
            } );
        } );

        return res;
    }

    async getUserToken ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

        if ( !token.ok ) return token;

        if ( !token.data ) return result( 404 );

        token.data.roles = this.api.userRoles.buildUserRoles( token.data.user_id, token.data.user_roles, token.data.roles );

        delete token.data.user_roles;

        return token;
    }

    async getUserTokens ( userId, options, ctx ) {
        if ( !this.#read ) {
            this.#read = new ( Read( Base ) )( this );
        }

        var where = this.dbh.where( sql`user_token.user_id = "user".id AND "user".id = ${userId}` );

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
                token.roles = this.api.userRoles.buildUserRoles( userId, token.user_roles, token.roles );

                delete token.user_roles;
            }
        }

        return tokens;
    }

    async deleteUserToken ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await dbh.do( QUERIES.delete, [tokenId] );

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 404 );

        return result( 200 );
    }

    async setUserTokenEnabled ( tokenId, enabled, { dbh } = {} ) {
        dbh ||= this.dbh;

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

    async getUserTokenRoles ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        const token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

        if ( !token.ok ) return token;

        if ( !token.data ) return result( 404 );

        const userRoles = this.api.userRoles.buildUserRoles( token.data.user_id, token.data.user_roles ),
            roles = [];

        // token roles is the user roles, overridden with the custom token roles
        for ( const id in userRoles ) {
            roles.push( {
                id,
                "enabled": userRoles[id] && token.data.roles[id],
            } );
        }

        this.api.userRoles.addRolesMetadata( roles );

        return result( 200, roles );
    }

    async setUserTokenRoles ( tokenId, roles, { dbh, userId } = {} ) {
        dbh ||= this.dbh;

        var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

        // dbh error
        if ( !token.ok ) return token;

        // token not found
        if ( !token.data ) return result( 404 );

        // check, that token belongs to the user
        if ( userId && userId !== token.data.user_id ) return result( [404, `Token not found`] );

        const userRoles = this.api.userRoles.buildUserRoles( token.data.user_id, token.data.user_roles );

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

    async updateUserTokenRoles ( tokenId, roles, { dbh, userId } = {} ) {
        dbh ||= this.dbh;

        var token = await dbh.selectRow( QUERIES.getUserTokenWithRoles, [tokenId] );

        // dbh error
        if ( !token.ok ) return token;

        // token not found
        if ( !token.data ) return result( 404 );

        // check, that token belongs to the user
        if ( userId && userId !== token.data.user_id ) return result( [404, `Token not found`] );

        const userRoles = this.api.userRoles.buildUserRoles( token.data.user_id, token.data.user_roles );

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

    // private
    #validateTokenRoles ( userRoles, tokenRoles ) {
        for ( const name in tokenRoles ) {

            // error, if user role is not enabled
            if ( !userRoles[name] ) return result( [400, `Token role "${name}" is not valid`] );
        }

        return result( 200 );
    }
}
