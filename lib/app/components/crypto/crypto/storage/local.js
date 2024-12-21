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

    async _saveKeys ( keys ) {
        const data = {};

        for ( const key of keys ) {
            data[ key.id ] = {
                "type": key.type,
                "key": this.wrapKey( key.key ),
            };
        }

        return fs.promises.writeFile( this.#storagePath, JSON.stringify( data ) );
    }
}
