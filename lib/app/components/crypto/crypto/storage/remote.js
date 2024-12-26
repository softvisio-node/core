import sql from "#lib/sql";
import CryptoStorage from "../storage.js";

const SQL = {
    "getActiveKey": sql`SELECT * FROM crypto_key WHERE revoked = FALSE`,

    "getKey": sql`SELECT * FROM crypto_key WHERE id = ?`.prepare(),

    "insertKey": sql`INSERT INTO crypto_key ( key ) VALUES ( ? ) RETURNING *`,

    "revokeKey": sql`UPDATE crypto_key SET revoked = TRUE`,

    "getKeys": sql`SELECT id, key FROM crypto_key`,

    "updateKey": sql`UPDATE crypto_key SET key = ? WHERE id = ?`.prepare(),
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

        // set dbh events
        this.dbh.on( "disconnect", this.clear.bind( this ) );

        this.dbh.on( "crypto/key/revoked/update", this._onKeyRevoked.bind( this ) );

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
            res = await this._revokeKey( { dbh } );
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

    async _revokeKey ( { dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.do( SQL.revokeKey );
    }

    async _rewrapKeys ( masterKey ) {
        var res;

        res = await this.dbh.selectAll( SQL.getKeys );
        if ( !res.ok ) return res;

        if ( !res.data ) return result( 200 );

        const keys = res.data;

        try {
            for ( const key of keys ) {
                res = await this._rewrapKey( key.key, masterKey );
                if ( !res.ok ) throw res;

                key.key = res.data;
            }
        }
        catch ( e ) {
            return result.catch( e );
        }

        return this.dbh.begin( async dbh => {
            for ( const key of keys ) {
                const res = await dbh.do( SQL.updateKey, [ key.key, key.id ] );

                if ( !res.ok ) return res;
            }
        } );
    }
}
