import Component from "#lib/app/api/component";
import constants from "#lib/app/constants";
import Token from "#lib/app/token";
import sql from "#lib/sql";
import Cache from "./tokens/cache.js";

const SQL = {
    "insertToken": sql`INSERT INTO api_token ( user_id, name, enabled ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),

    "insertHash": sql`INSERT INTO api_token_hash ( api_token_id, hash ) VALUES ( ?, ? )`.prepare(),

    "updatePublic": sql`UPDATE api_token SET public = ? WHERE id = ?`.prepare(),

    "setEnabled": sql`UPDATE api_token SET enabled = ? WHERE id = ?`.prepare(),

    "delete": sql`DELETE FROM api_token WHERE id = ?`.prepare(),

    "getToken": sql`SELECT * FROM api_token WHERE id = ?`.prepare(),
};

export default class extends Component {
    #cache;

    // properties
    get cache () {
        return this.#cache;
    }

    // public
    async createToken ( userId, name, enabled, options = {} ) {
        const dbh = options.dbh || this.dbh;

        // start transaction
        var res = await dbh.begin( async dbh => {

            // insert token
            let res = await dbh.selectRow( SQL.insertToken, [ userId, name, enabled ] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            const id = res.data.id;

            // generate token
            const token = await Token.generate( this.app, constants.apiToken.id, id, { "length": constants.apiToken.length } );

            // insert hash
            res = await dbh.do( SQL.insertHash, [ token.id, token.hash ] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            // update public
            res = await dbh.do( SQL.updatePublic, [ token.public, token.id ] );
            if ( !res.ok || !res.meta.rows ) throw result( 500 );

            return result( 200, {
                "id": token.id,
                "token": token.token,
                "userId": userId,
            } );
        } );

        return res;
    }

    async getToken ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        var token = await dbh.selectRow( SQL.getToken, [ tokenId ] );

        if ( !token.ok ) return token;

        if ( !token.data ) return result( 404 );

        return token;
    }

    async deleteToken ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await dbh.do( SQL.delete, [ tokenId ] );

        if ( !res.ok ) return res;

        if ( !res.meta.rows ) return result( 404 );

        return result( 200 );
    }

    async setTokenEnabled ( tokenId, enabled, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setEnabled, [ enabled, tokenId ] );

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

    // protected
    async _init () {
        this.#cache = new Cache( this.api, this.api.config.apiTokensCacheMaxSize );

        await this.#cache.init();

        return result( 200 );
    }
}
