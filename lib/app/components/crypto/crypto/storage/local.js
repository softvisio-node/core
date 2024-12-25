import fs from "node:fs";
import path from "node:path";
import CryptoStorage from "../storage.js";

export default class LocalCryptoStorage extends CryptoStorage {
    #storagePath;
    #storage;

    constructor ( ...args ) {
        super( ...args );

        this.#storagePath = this.app.env.dataDir + "/crypto/storage.json";
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _getActiveKey () {
        const storage = await this.#readStorage();

        return result( 200, storage.keys[ storage.activeKeyId ] );
    }

    async _getKey ( id ) {
        const storage = await this.#readStorage();

        return result( 200, storage.keys[ id ] );
    }

    async _createKey ( key ) {
        var id = 0,
            storage = await this.#readStorage();

        storage = structuredClone( storage );

        for ( const _id of Object.keys( storage.keys ) ) {
            if ( _id > id ) id = _id;
        }

        key.id = ++id;

        if ( storage.activeKeyId ) {
            storage.keys[ storage.activeKeyId ].revoked = true;
        }

        storage.keys[ key.id ] = key;

        storage.activeKeyId = id;

        const res = await this.#writeStorage( storage );
        if ( !res.ok ) return res;

        return result( 200, key.id );
    }

    async _revokeKey () {
        var storage = await this.#readStorage();

        storage = structuredClone( storage );

        storage.activeKeyId = null;

        return this.#writeStorage( storage );
    }

    // private
    async #readStorage () {
        if ( !this.#storage ) {
            if ( await fs.promises.stat( this.#storagePath ).catch( e => null ) ) {
                this.#storage = JSON.parse( await fs.promises.readFile( this.#storagePath ) );
            }
            else {
                this.#storage = {
                    "activeKeyId": null,
                    "keys": {},
                };
            }
        }

        return this.#storage;
    }

    async #writeStorage ( storage ) {
        try {
            await fs.promises.mkdir( path.dirname( this.#storagePath ), {
                "recursive": true,
            } );

            await fs.promises.writeFile( this.#storagePath, JSON.stringify( storage ) );

            this.#storage = storage;

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }
}
