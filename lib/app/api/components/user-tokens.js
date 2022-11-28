import Component from "#lib/app/api/component";
import sql from "#lib/sql";
import Token from "#lib/app/api/token";
import constants from "#lib/app/constants";

const QUERIES = {
    "storeHash": sql`INSERT INTO user_token_hash ( user_token_id, fingerprint, hash ) VALUES ( ?, ?, ? )`.prepare(),
    "insertToken": sql`INSERT INTO user_token ( user_id, name, enabled ) VALUES ( ?, ?, ? ) RETURNING id`.prepare(),
    "setEnabled": sql`UPDATE user_token SET enabled = ? WHERE id = ?`.prepare(),
    "delete": sql`DELETE FROM user_token WHERE id = ?`.prepare(),
    "getUserToken": sql`SELECT * FROM user_token WHERE id = ?`.prepare(),
};

export default class extends Component {

    // public
    async createUserToken ( userId, name, enabled, options = {} ) {
        const dbh = options.dbh || this.dbh;

        // start transaction
        var res = await dbh.begin( async dbh => {

            // insert token
            let res = await dbh.selectRow( QUERIES.insertToken, [userId, name, enabled] );
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
            } );
        } );

        return res;
    }

    async getUserToken ( tokenId, { dbh } = {} ) {
        dbh ||= this.dbh;

        var token = await dbh.selectRow( QUERIES.getUserToken, [tokenId] );

        if ( !token.ok ) return token;

        if ( !token.data ) return result( 404 );

        return token;
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
}
