import sql from "#lib/sql";
import CryptoStorage from "../storage.js";

const SQL = {
    "loadKeys": sql`SELECT * FROM crypto_storage`,
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

    async _loadKeys () {
        return this.dbh.select( SQL.loadKeys );
    }
}
