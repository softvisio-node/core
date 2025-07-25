import crypto from "node:crypto";
import { decrypt, encrypt, getCipherInfo, hash } from "#lib/crypto";
import msgpack from "#lib/msgpack";
import Mutex from "#lib/threads/mutex";

const MASTER_KEY_ID = -1;

export default class CryptoStorage {
    #crypto;
    #masterKey;
    #cipherInfo;
    #keys = {};
    #activeKey;
    #mutexes = new Mutex.Set();

    constructor ( crypto, masterKey ) {
        this.#crypto = crypto;
        this.#masterKey = masterKey;
        this.#cipherInfo = getCipherInfo( this.#crypto.algorithm );
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

        // check mster key hash
        const masterKeyHash = await this.#createKeyHash( this.#masterKey.key );

        res = await this._checkMasterKeyHash( masterKeyHash );
        if ( !res.ok ) return res;

        // load active key
        res = await this.#getActiveKey();
        if ( !res ) return result( [ 500, "Unable to load key" ] );

        return result( 200 );
    }

    async encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        key ||= await this.#getKey();

        return encrypt( data, {
            inputEncoding,
            outputEncoding,
            "init": this.#initEncryption.bind( this ),
            key,
        } );
    }

    async decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return decrypt( data, {
            inputEncoding,
            outputEncoding,
            "init": this.#initEncryption.bind( this ),
        } );
    }

    async revokeKey () {
        const mutex = this.#mutexes.get( "revoke-key" );
        if ( !mutex.tryLock() ) return mutex.wait();

        const sharedMutex = this._getSharedMutex( "lock" ),
            locked = await sharedMutex.tryLock();

        if ( !locked ) {
            const res = result( [ 500, "Operation in progress" ] );

            mutex.unlock( res );

            return res;
        }

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
        const mutex = this.#mutexes.get( "revoke-master-key" );
        if ( !mutex.tryLock() ) return mutex.wait();

        const sharedMutex = this._getSharedMutex( "lock" ),
            locked = await sharedMutex.tryLock();

        if ( !locked ) {
            const res = result( [ 500, "Operation in progress" ] );

            mutex.unlock( res );

            return res;
        }

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

            const masterKeyHash = await this.#createKeyHash( masterKey.key );

            res = await this._reencryptKeys( masterKey, masterKeyHash );
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
    _onKeyRevoked ( { id, revoked } ) {
        if ( this.#activeKey?.id === id ) {
            this.#activeKey = null;
        }

        if ( this.#keys[ id ] ) {
            this.#keys[ id ].revoked = new Date( revoked );
        }
    }

    async _encryptKey ( unencryptedKey, { masterKey } = {} ) {
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

    async _decryptKey ( encryptedKey ) {
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

    async _reencryptKey ( encryptedKey, masterKey ) {
        var res;

        res = await this._decryptKey( encryptedKey );
        if ( !res.ok ) return res;

        const unencryptedKey = res.data;

        res = await this._encryptKey( unencryptedKey, { masterKey } );
        if ( !res.ok ) return res;

        encryptedKey = res.data;

        return result( 200, encryptedKey );
    }

    // private
    #parseKey ( key ) {
        try {
            if ( Buffer.isBuffer( key ) || typeof key === "string" ) {
                key = crypto.createSecretKey( key, "base64url" );
            }

            // check master key length
            if ( key.type !== "secret" || key.symmetricKeySize !== this.#cipherInfo.keyLength ) {
                return result( [ 400, `AES key ${ this.#cipherInfo.keyLength } bytes length is required` ] );
            }

            return result( 200, key );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #generateKey () {
        return new Promise( resolve => {
            crypto.generateKey(
                "aes",
                {
                    "length": this.#cipherInfo.keyLength * 8,
                },
                ( e, key ) => resolve( e
                    ? result( [ 500, e ] )
                    : result( 200, key ) )
            );
        } );
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

                res = await this._encryptKey( unencryptedKey );
                if ( !res.ok ) throw res;

                const encryptedKey = res.data;

                const masterKeyHash = await this.#createKeyHash( this.#masterKey.key );

                res = await this._createKey( encryptedKey, masterKeyHash );
                if ( !res.ok ) throw res;

                key = res.data;
            }

            // cache key
            res = await this.#cacheKey( key );
            if ( !res.ok ) throw res;

            res = result( 200 );
        }
        catch ( e ) {
            res = result.catch( e, { "log": false } );
        }

        await sharedMutex.unlock();

        mutex.unlock( res );

        return res;
    }

    async #cacheKey ( key ) {
        var res;

        res = await this._decryptKey( key.key );
        if ( !res.ok ) return res;

        key.key = res.data;

        key.created = new Date( key.created );

        this.#keys[ key.id ] = key;

        // revoked key
        if ( key.revoked ) {
            key.revoked = new Date( key.revoked );

            // remove current active key
            if ( this.#activeKey?.id === key.id ) {
                this.#activeKey = null;
            }
        }

        // active key
        else {

            // mark current active key as revoked
            if ( this.#keys[ this.#activeKey ] ) {
                this.#keys[ this.#activeKey ].revoked = new Date();
            }

            this.#activeKey = key;
        }

        return result( 200 );
    }

    async #createKeyHash ( key ) {
        return hash(
            "SHA3-512",
            key.export( {
                "format": "buffer",
            } ),
            {
                "outputEncoding": "base64url",
            }
        );
    }

    async #initEncryption ( { buffer, key } = {} ) {

        // read header
        if ( buffer ) {

            // try to decode header
            const res = msgpack.decodeStream( buffer );

            // header is not complete
            if ( !res?.offset ) return;

            const [ algorithm, keyId, iv ] = res.value;

            key = await this.#getKey( keyId );

            return {
                algorithm,
                "key": key.key,
                iv,
                "offset": res.offset,
            };
        }

        // create header
        else {

            // generate iv
            const iv = await new Promise( ( resolve, reject ) => {
                crypto.randomBytes( this.#cipherInfo.ivLength, ( e, buffer ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( buffer );
                    }
                } );
            } );

            return {
                "algorithm": this.#cipherInfo.algorithm,
                "key": key.key,
                iv,
                "header": msgpack.encode( [ this.#cipherInfo.algorithm, key.id, iv ] ),
            };
        }
    }
}
