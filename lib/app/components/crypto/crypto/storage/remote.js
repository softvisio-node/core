import sql from "#lib/sql";
import CryptoStorage from "../storage.js";

const SQL = {
    "getActiveKey": sql`SELECT * FROM crypto_key WHERE revoked IS NULL`,

    "getKey": sql`SELECT * FROM crypto_key WHERE id = ?`.prepare(),

    "insertKey": sql`INSERT INTO crypto_key ( key ) VALUES ( ? ) RETURNING *`,

    "revokeKey": sql`UPDATE crypto_key SET revoked = CURRENT_TIMESTAMP`,

    "getKeys": sql`SELECT id, key FROM crypto_key`,

    "updateKey": sql`UPDATE crypto_key SET key = ? WHERE id = ?`.prepare(),

    "getMasterKeyHash": sql`SELECT key FROM crypto_key WHERE id = ?`,

    "inssertMasterKeyHash": sql`INSERT INTO crypto_key ( id, key, revoked ) VALUES ( ?, ?, CURRENT_TIMESTAMP )`,

    "updateMasterKeyHash": sql`UPDATE crypto_key SET key = ? WHERE id = ?`,
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

    _getSharedMutex ( id ) {
        id = "/crypto/" + id;

        return this.app.cluster.mutexes.get( id );
    }

    async _checkMasterKeyHash ( masterKeyHash ) {
        var res;

        res = await this.dbh.selectRow( SQL.getMasterKeyHash, [ this.masterKeyId ] );
        if ( !res.ok ) return res;

        if ( res.data?.key && res.data.key !== masterKeyHash ) {
            return result( [ 500, "Maseter key is not valid" ] );
        }
        else {
            return result( 200 );
        }
    }

    async _getActiveKey () {
        return this.dbh.selectRow( SQL.getActiveKey );
    }

    async _getKey ( id ) {
        return this.dbh.selectRow( SQL.getKey, [ id ] );
    }

    async _createKey ( encryptedKey, masterKeyHash ) {
        return await this.dbh.begin( async dbh => {
            var res;

            // check master key
            res = await dbh.selectRow( SQL.getMasterKeyHash, [ this.masterKeyId ] );
            if ( !res.ok ) return res;

            if ( res.data ) {
                if ( res.data.key !== masterKeyHash ) {
                    return result( [ 500, "Master key is revoked" ] );
                }
            }
            else {
                res = await dbh.do( SQL.inssertMasterKeyHash, [ this.masterKeyId, masterKeyHash ] );
                if ( !res.ok ) return res;
            }

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

    async _reencryptKeys ( masterKey, masterKeyHash ) {
        var res;

        res = await this.dbh.select( SQL.getKeys );
        if ( !res.ok ) return res;

        if ( !res.data ) return result( 200 );

        const keys = res.data;

        for ( const key of keys ) {
            if ( key.id === this.masterKeyId ) continue;

            res = await this._reencryptKey( key.key, masterKey );
            if ( !res.ok ) return res;

            key.key = res.data;
        }

        return this.dbh.begin( async dbh => {
            var res;

            res = await dbh.do( SQL.updateMasterKeyHash, [ masterKeyHash, this.masterKeyId ] );
            if ( !res.ok ) return res;

            for ( const key of keys ) {
                if ( key.id === this.masterKeyId ) continue;

                res = await dbh.do( SQL.updateKey, [ key.key, key.id ] );
                if ( !res.ok ) return res;
            }
        } );
    }
}
