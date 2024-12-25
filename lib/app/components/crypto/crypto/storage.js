import crypto from "node:crypto";
import { decrypt, encrypt } from "#lib/crypto";
import Mutex from "#lib/threads/mutex";

const MASTER_KEY_ID = -1;

export default class CryptoStorage {
    #crypto;
    #masterKey;
    #keys;
    #activeKey;
    #mutexes = new Mutex.Set();

    constructor ( crypto, masterKey ) {
        this.#crypto = crypto;
        this.#masterKey = masterKey;
    }

    // properties
    get app () {
        return this.#crypto.app;
    }

    // public
    async init () {
        var res;

        // create master key
        res = this.#parseKey( this.#masterKey );
        if ( !res.ok ) return res;

        this.#masterKey = {
            "id": MASTER_KEY_ID,
            "key": res.data,
        };

        // init
        res = await this._init();
        if ( !res ) return res;

        return result( 200 );
    }

    async encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        return encrypt( key || ( await this.#getKey() ), data, {
            inputEncoding,
            outputEncoding,
        } );
    }

    async decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return decrypt( id => this.#getKey( id ), data, {
            inputEncoding,
            outputEncoding,
        } );
    }

    async revokeKey () {
        if ( !this.#activeKey ) return result( 200 );

        const getActiveKeyMutex = this.#mutexes.get( "get-active-key" );
        if ( getActiveKeyMutex.isLocked ) await getActiveKeyMutex.wait();

        const mutex = this.#mutexes.get( "revoke-key" );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this._revokeKey();

        if ( res.ok ) {
            this.#activeKey = null;
        }

        mutex.unlock( res );

        return res;
    }

    // XXX
    async changeMasterKey ( key ) {
        var res;

        if ( key ) {

            // XXX check key, aes, 256
        }
        else {
            res = await this.#generateKey( "aes" );
            if ( !res.ok ) return res;

            key = res.data.key;
        }

        // XXX re-wrap keys with new master key

        return result( 200, {
            key,
        } );
    }

    clear () {
        this.#activeKey = null;
        this.#keys = {};
    }

    // protected
    async _getActiveKey () {
        return result( [ 500, "Not implemented" ] );
    }

    async _getKey ( id ) {
        return result( [ 500, "Not implemented" ] );
    }

    async _createKey ( key ) {
        return result( [ 500, "Not implemented" ] );
    }

    async _revokeKey () {
        return result( [ 500, "Not implemented" ] );
    }

    // private
    #parseKey ( key ) {
        if ( Buffer.isBuffer( key ) || typeof key === "string" ) {
            key = crypto.createSecretKey( key, "base64url" );
        }

        if ( key.type !== "secret" || key.symmetricKeySize !== 32 ) {
            return result( [ 400, `AES key 256 bits length is required` ] );
        }

        return result( 200, key );
    }

    async #generateKey () {
        const key = await new Promise( resolve => {
            crypto.generateKey(
                "aes",
                {
                    "length": 256,
                },
                ( e, key ) => resolve( key )
            );
        } );

        return result( 200, {
            "id": null,
            "created": new Date(),
            "revoked": false,
            key,
        } );
    }

    async #wrapKey ( unencryptedKey ) {
        unencryptedKey = unencryptedKey.export( {
            "format": "buffer",
        } );

        return this.encrypt( unencryptedKey, {
            "key": this.#masterKey,
            "outputEncoding": "base64url",
        } );
    }

    async #unwrapKey ( encryptedKey ) {
        const key = this.decrypt( encryptedKey, {
            "inputEncoding": "base64url",
        } );

        const res = this.#parseKey( key );

        return res.data;
    }

    async #getKey ( id ) {
        if ( !id ) {
            if ( this.#activeKey ) {
                return this.#activeKey;
            }
            else {
                return this.#getActiveKey();
            }
        }
        else if ( id === MASTER_KEY_ID ) {
            return this.#masterKey;
        }
        else if ( this.#keys[ id ] ) {
            return this.#keys[ id ];
        }
        else {
            return this.#loadKey( id );
        }
    }

    async #getActiveKey () {
        if ( this.#activeKey ) return this.#activeKey;

        const revokeKeyMutex = this.mutexes.get( "revoke-key" );
        if ( revokeKeyMutex.isLocked ) await this.revokeKeyMutex.wait();

        const mutex = this.#mutexes.get( "get-active-key" );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        try {

            // get active key
            res = await this._getActiveKey();
            if ( !res.ok ) throw res;

            if ( res.data ) {
                const key = res.data;

                try {
                    key.key = await this.#unwrapKey( key.key );

                    this.#activeKey = key;
                }
                catch {}
            }

            // create active key
            if ( !res.data ) {
                res = await this.#createKey();
                if ( !res.ok ) throw res;
            }
        }
        catch {}

        mutex.unlock( this.#activeKey );

        return this.#activeKey;
    }

    async #loadKey ( id ) {
        if ( this.#keys[ id ] ) return this.#keys[ id ];

        const mutex = this.#mutexes.get( "get-key/" + id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this._getKey( id );

        if ( res.ok ) {
            const key = res.data;

            try {
                key.key = this.#unwrapKey( key.key );

                this.#keys[ key.id ] = key;
            }
            catch {}
        }

        mutex.unlock( this.#keys[ id ] );

        return this.#keys[ id ];
    }

    async #createKey () {
        if ( !this.#mutexes.tryLock() ) return this.#mutexes.wait();

        var key = await this.#generateKey();

        const res = await this._createKey( {
            ...key,
            "key": await this.#wrapKey( key.key ),
        } );

        if ( res.ok ) {
            key.id = res.data;

            if ( this.#keys[ this.#activeKey ] ) {
                this.#keys[ this.#activeKey ].revoked = true;
            }

            this.#activeKey = key;
            this.#keys[ key.id ] = key;
        }
        else {
            key = null;
        }

        this.#mutexes.unlock( key );

        return key;
    }
}
