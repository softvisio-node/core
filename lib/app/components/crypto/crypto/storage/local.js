import fs from "node:fs";
import { readConfig } from "#lib/config";
import CryptoStorage from "../storage.js";

export default class LocalCryptoStorage extends CryptoStorage {
    #storagePath;

    constructor ( ...args ) {
        super( ...args );

        this.#storagePath = this.app.env.dataDir + "/crypto-storage.json";
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _loadKeys () {
        if ( await fs.promises.stat( this.#storagePath ) ) return result( 200 );

        return result( 200, readConfig( this.#storagePath ) );
    }

    async _addKey ( type ) {
        var res,
            id = 0;

        res = await this._loadKeys();
        if ( !res.ok ) return res;

        const keys = res.data || [];

        for ( const row of keys ) {
            if ( row.id > id ) id = row.id;

            if ( row.type === type ) row.active = false;
        }

        // generate key
        res = await this._generateKey( type );
        if ( !res.ok ) return res;

        const key = res.data;

        key.id = ++id;
        key.active = true;

        const encrypted = {
            ...key,
        };

        encrypted.key = this._wrapKey( key );

        keys.push( encrypted );

        await fs.promises.writeFile( this.#storagePath, JSON.stringify( keys ) );

        return result( 200, key );
    }
}
