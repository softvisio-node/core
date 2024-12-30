import fs from "node:fs";
import path from "node:path";
import Mutex from "#lib/threads/mutex";
import CryptoStorage from "../storage.js";

export default class LocalCryptoStorage extends CryptoStorage {
    #storagePath;
    #storage;
    #mutexes = new Mutex.Set();

    constructor ( ...args ) {
        super( ...args );

        this.#storagePath = this.app.env.dataDir + "/crypto/storage.json";
    }

    // protected
    async _init () {
        return result( 200 );
    }

    _getSharedMutex ( id ) {
        id = "/crypto/" + id;

        return this.#mutexes.get( id );
    }

    async _checkMasterKeyHash ( masterKeyHash ) {
        var res;

        res = await this.#readStorage();
        if ( !res.ok ) return res;

        if ( this.#storage.masterKeyHash && this.#storage.masterKeyHash !== masterKeyHash ) {
            return result( [ 500, "Maseter key is not valid" ] );
        }
        else {
            return result( 200 );
        }
    }

    async _getActiveKey () {
        const res = await this.#readStorage();
        if ( !res.ok ) return res;

        const key = this.#storage.keys[ this.#storage.activeKeyId ];

        if ( key ) {
            return result( 200, { ...key } );
        }
        else {
            return result( 200 );
        }
    }

    async _getKey ( id ) {
        const res = await this.#readStorage();
        if ( !res.ok ) return res;

        const key = this.#storage.keys[ id ];

        if ( key ) {
            return result( 200, { ...key } );
        }
        else {
            return result( 200 );
        }
    }

    async _createKey ( encryptedKey, masterKeyHash ) {
        var res;

        res = await this.#readStorage();
        if ( !res.ok ) return res;

        const storage = structuredClone( this.#storage );

        if ( !storage.masterKeyHash ) {
            storage.masterKeyHash = masterKeyHash;
        }
        else if ( storage.masterKeyHash !== masterKeyHash ) {
            return result( [ 500, "Master key is revoked" ] );
        }

        var id = 0;

        for ( const _id of Object.keys( storage.keys ) ) {
            if ( _id > id ) id = _id;
        }

        const key = {
            "id": ++id,
            "created": new Date().toISOString(),
            "revoked": false,
            "revoke_date": null,
            "key": encryptedKey,
        };

        // revoke current key
        if ( storage.activeKeyId ) {
            storage.keys[ storage.activeKeyId ].revoked = true;
            storage.keys[ storage.activeKeyId ].revoke_date = new Date();
        }

        storage.keys[ key.id ] = key;

        storage.activeKeyId = key.id;

        res = await this.#writeStorage( storage );
        if ( !res.ok ) return res;

        return result( 200, { ...key } );
    }

    async _revokeKey () {
        const res = await this.#readStorage();
        if ( !res.ok ) return res;

        const storage = structuredClone( this.#storage );

        // revoke key
        if ( storage.activeKeyId ) {
            storage.keys[ storage.activeKeyId ].revoked = true;
            storage.keys[ storage.activeKeyId ].revoke_date = new Date();
        }

        storage.activeKeyId = null;

        return this.#writeStorage( storage );
    }

    async _rewrapKeys ( masterKey, masterKeyHash ) {
        var res;

        res = await this.#readStorage();
        if ( !res.ok ) return res;

        const storage = structuredClone( this.#storage );

        try {
            for ( const key of Object.values( storage.keys ) ) {
                res = await this._rewrapKey( key.key, masterKey );
                if ( !res.ok ) throw res;

                key.key = res.data;
            }
        }
        catch ( e ) {
            return result.catch( e );
        }

        storage.masterKeyHash = masterKeyHash;

        return this.#writeStorage( storage );
    }

    // private
    async #readStorage () {
        if ( !this.#storage ) {
            try {
                if ( await fs.promises.stat( this.#storagePath ).catch( e => null ) ) {
                    this.#storage = JSON.parse( await fs.promises.readFile( this.#storagePath ) );
                }
                else {
                    this.#storage = {
                        "masterKeyHash": null,
                        "activeKeyId": null,
                        "keys": {},
                    };
                }
            }
            catch ( e ) {
                return result.catch( e, { "log": false } );
            }
        }

        return result( 200 );
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
            return result.catch( e, { "log": false } );
        }
    }
}
