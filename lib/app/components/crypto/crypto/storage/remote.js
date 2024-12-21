import sql from "#lib/sql";
import CryptoStorage from "../storage.js";

const SQL = {
    "loadKeys": sql`SELECT * FROM crypto_storage`,

    "setActive": sql`UPDATE crypto_storage SET active = FALSE WHERE type = ?`,

    "insertKey": sql`INSERT INTO crypto_storage ( type, created, active, key ) VALUES ( ?, ?, TRUE, ? ) RETURNING id`,
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

    async _addKey ( type ) {
        var res;

        // generate key
        res = await this._generateKey( type );
        if ( !res.ok ) return res;

        const key = res.data;

        key.active = true;

        const encrypted = this._wrapKey( key );

        res = await this.dbh.begin( async dbh => {
            var res;

            res = await dbh.do( SQL.setActive, [ type ] );
            if ( !res ) return res;

            res = await dbh.selectRow( SQL.insertKey, [ key, type, key.created, encrypted ] );
            if ( !res.ok ) return res;

            key.id = res.data.id;
        } );
        if ( !res.ok ) return res;

        return result( 200, key );
    }
}
