import sql from "#lib/sql";
import CryptoStorage from "../storage.js";

const SQL = {
    "getActiveKey": sql`SELECT * FROM crypto_storage WHERE revoked = FALSE`,

    "getKey": sql`SELECT * FROM crypto_storage WHERE id = ?`.prepare(),

    "insertKey": sql`INSERT INTO crypto_storage ( key ) VALUES ( ? ) RETURNING *`,

    "revokeKey": sql`UPDATE crypto_storage SET revoked = TRUE`,
};

export default class RemoteCryptoStorage extends CryptoStorage {

    // properties
    get dbh () {
        return this.app.dbh;
    }

    // protected
    async _init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "../../db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async _getActiveKey () {
        return this.dbh.selectRow( SQL.getActiveKey );
    }

    async _getKey ( id ) {
        return this.dbh.selectRow( SQL.getKey, [ id ] );
    }

    async _createKey ( encryptedKey ) {
        return await this.dbh.begin( async dbh => {
            var res;

            // revoke current key
            res = await this._revokeKey();
            if ( !res.ok ) return res;

            // insert new key
            res = await this.dbh.selectRow( SQL.insertKey, [

                //
                encryptedKey,
            ] );
            if ( !res.ok ) return res;

            return result( 200, res.data );
        } );
    }

    async _revokeKey () {
        return this.dbh.do( SQL.revokeKey );
    }
}
