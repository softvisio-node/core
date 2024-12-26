import crypto from "node:crypto";
import { decrypt, encrypt } from "#lib/crypto";
import Mutex from "#lib/threads/mutex";

const MASTER_KEY_ID = -1;

export default class CryptoStorage {
    #crypto;
    #masterKey;
    #keys = {};
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

    get masterKeyId () {
        return MASTER_KEY_ID;
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

        // load active key
        res = await this.#getActiveKey();
        if ( !res ) return result( [ 500, "Unable to load active key" ] );

        return result( 200 );
    }

    async encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        key ||= await this.#getKey();

        return encrypt( key, data, {
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
        const mutex = this.#mutexes.get( "revoke-key" );
        if ( !mutex.tryLock() ) return mutex.wait();

        const sharedMutex = this._getSharedMutex( "lock" );
        await sharedMutex.lock();

        var res;

        try {

            // get active key
            res = await this._getActiveKey();
            if ( !res.ok ) throw res;

            // no active key
            if ( !res.data ) throw result( 200 );

            // revoke active key
            res = await this._revokeKey();
            if ( !res.ok ) throw res;

            this.#activeKey = null;

            res = result( 200 );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        await sharedMutex.unlock();

        mutex.unlock( res );

        return res;
    }

    async revokeMasterKey ( masterKey ) {
        const mutex = this.#mutexes.get( "change-master-key" );
        if ( !mutex.tryLock() ) return mutex.wait();

        const sharedMutex = this._getSharedMutex( "lock" );
        await sharedMutex.lock();

        var res;

        try {

            // parse master key
            if ( masterKey ) {
                res = this.#parseKey( masterKey );
                if ( !res.ok ) throw res;

                masterKey = res.data;
            }

            // generate master key
            else {
                res = await this.#generateKey();
                if ( !res.ok ) throw res;

                masterKey = res.data;
            }

            masterKey = {
                "id": MASTER_KEY_ID,
                "key": masterKey,
            };

            const masterKeyHash = this.#createKeyHash( masterKey.key );

            res = await this._rewrapKeys( masterKey, masterKeyHash );
            if ( !res.ok ) throw res;

            this.#masterKey = masterKey;
            this.clear();

            res = result( 200, {
                "masterKey": masterKey.key
                    .export( {
                        "format": "buffer",
                    } )
                    .toString( "base64url" ),
            } );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        await sharedMutex.unlock();

        mutex.unlock( res );

        return res;
    }

    clear () {
        this.#activeKey = null;
        this.#keys = {};
    }

    // protected
    _onKeyRevoked ( { id } ) {
        if ( this.#activeKey?.id === id ) {
            this.#activeKey = null;
        }

        if ( this.#keys[ id ] ) {
            this.#keys[ id ].revoked = true;
        }
    }

    async _wrapKey ( unencryptedKey, { masterKey } = {} ) {
        try {
            unencryptedKey = unencryptedKey.export( {
                "format": "buffer",
            } );

            const encryptedKey = await this.encrypt( unencryptedKey, {
                "key": masterKey || this.#masterKey,
                "outputEncoding": "base64url",
            } );

            return result( 200, encryptedKey );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _unwrapKey ( encryptedKey ) {
        try {
            const key = await this.decrypt( encryptedKey, {
                "inputEncoding": "base64url",
            } );

            const res = this.#parseKey( key );

            return res;
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _rewrapKey ( encryptedKey, masterKey ) {
        var res;

        res = await this._unwrapKey( encryptedKey );
        if ( !res.ok ) return res;

        res = await this._wrapKey( res.data, { masterKey } );
        if ( !res.ok ) return res;

        return result( 200, res.data );
    }

    async _getActiveKey () {
        return result( [ 500, "Not implemented" ] );
    }

    async _getKey ( id ) {
        return result( [ 500, "Not implemented" ] );
    }

    async _createKey ( encryptedKey, masterKeyHash ) {
        return result( [ 500, "Not implemented" ] );
    }

    async _revokeKey () {
        return result( [ 500, "Not implemented" ] );
    }

    async _rewrapKeys ( masterKey, masterKeyHash ) {
        return result( [ 500, "Not implemented" ] );
    }

    // private
    #parseKey ( key ) {
        try {
            if ( Buffer.isBuffer( key ) || typeof key === "string" ) {
                key = crypto.createSecretKey( key, "base64url" );
            }

            if ( key.type !== "secret" || key.symmetricKeySize !== 32 ) {
                return result( [ 400, `AES key 256 bits length is required` ] );
            }

            return result( 200, key );
        }
        catch ( e ) {
            return result.catch( e );
        }
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

        return result( 200, key );
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

        const mutex = this.#mutexes.get( "get-active-key" );
        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        try {

            // get active key
            res = await this._getActiveKey();
            if ( !res.ok ) throw res;

            // active key found
            if ( res.data ) {

                // cache key
                res = await this.#cacheKey( res.data );
                if ( !res.ok ) throw res;
            }

            // create active key
            else {
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

        var res;

        try {
            res = await this._getKey( id );
            if ( !res.ok ) throw res;

            if ( !res.data ) throw "key not found";

            // cache key
            res = await this.#cacheKey( res.data );
            if ( !res.ok ) throw res;
        }
        catch {}

        mutex.unlock( this.#keys[ id ] );

        return this.#keys[ id ];
    }

    async #createKey () {
        const mutex = this.#mutexes.get( "create-key" );

        if ( !mutex.tryLock() ) return mutex.wait();

        const sharedMutex = this._getSharedMutex( "lock" );
        await sharedMutex.lock();

        var res, key;

        try {

            // get active key
            res = await this._getActiveKey();
            if ( !res.ok ) throw res;

            // active key exists
            if ( res.data ) {
                key = res.data;
            }

            // create key
            else {
                res = await this.#generateKey();
                if ( !res.ok ) throw res;

                const unencryptedKey = res.data;

                res = await this._wrapKey( unencryptedKey );
                if ( !res.ok ) throw res;

                const encryptedKey = res.data;

                const masterKeyHash = this.#createKeyHash( this.#masterKey.key );

                res = await this._createKey( encryptedKey, masterKeyHash );
                if ( !res.ok ) throw res;

                key = res.data;
            }

            // cache key
            res = await this.#cacheKey( key );
            if ( !res.ok ) throw res;
        }
        catch {
            key = null;
        }

        await sharedMutex.unlock();

        mutex.unlock( key );

        return key;
    }

    async #cacheKey ( key ) {
        var res;

        res = await this._unwrapKey( key.key );
        if ( !res.ok ) return res;

        key.key = res.data;

        key.created = new Date( key.created );

        this.#keys[ key.id ] = key;

        // active key
        if ( !key.revoked ) {
            if ( this.#keys[ this.#activeKey ] ) {
                this.#keys[ this.#activeKey ].revoked = true;
            }

            this.#activeKey = key;
        }

        return result( 200 );
    }

    #createKeyHash ( key ) {
        return crypto
            .createHash( "SHA3-512" )
            .update( key.export( {
                "format": "buffer",
            } ) )
            .digest( "base64url" );
    }
}
