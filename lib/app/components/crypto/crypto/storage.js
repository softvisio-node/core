import crypto from "node:crypto";
import { decrypt, encrypt } from "#lib/crypto";

const MASTER_KEY_ID = -1;

export default class CryptoStorage {
    #crypto;
    #masterKey;
    #keys;
    #activeKeys;

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

        // create master key
        this.#masterKey = {
            "id": MASTER_KEY_ID,
            "key": crypto.createSecretKey( this.#masterKey, "base64url" ),
        };

        if ( this.#masterKey.key.type !== "secret" || this.#masterKey.key.symmetricKeySize !== 32 ) {
            return result( [ 400, `AES key 256 bits length is required` ] );
        }

        var res;

        // init
        res = await this._init();
        if ( !res ) return res;

        // load keys
        res = await this.loadKeys();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async loadKeys () {
        var res;

        res = await this._loadKeys();
        if ( !res.ok ) return res;

        this.#keys = {};
        this.#activeKeys = {};

        const keys = res.data || [];

        for ( const key of keys ) {
            this.#keys[ key.id ] = key;

            key.key = crypto.createSecretKey( this.decrypt( key.key, {
                "inputEncoding": "base64url",
            } ) );

            if ( key.active ) {
                this.#activeKeys[ key.type ] = key;
            }
        }

        // add AES key
        if ( !this.#activeKeys.aes ) {
            res = await this._addKey( "aes" );
            if ( !res.ok ) return res;

            return this.loadKeys();
        }

        return result( 200 );
    }

    encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        return encrypt( () => key || this.#activeKeys.aes, data, {
            inputEncoding,
            outputEncoding,
        } );
    }

    decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return decrypt( id => this.#getKey( id ), data, {
            inputEncoding,
            outputEncoding,
        } );
    }

    // protected
    async _generateKey ( type ) {
        var key;

        if ( type === "aes" ) {
            key = await new Promise( resolve => {
                crypto.generateKey(
                    "aes",
                    {
                        "length": 256,
                    },
                    ( e, key ) => resolve( key )
                );
            } );
        }
        else {
            return result( [ 400, "Invalid key type" ] );
        }

        return result( 200, {
            "id": null,
            type,
            "created": new Date(),
            "active": false,
            key,
        } );
    }

    _wrapKey ( key ) {
        key = key.key.export( {
            "format": "buffer",
        } );

        return this.encrypt( key, {
            "key": this.#masterKey,
            "outputEncoding": "base64url",
        } );
    }

    // private
    #getKey ( id ) {
        if ( id === MASTER_KEY_ID ) {
            return this.#masterKey.key;
        }
        else {
            return this.#keys[ id ]?.key;
        }
    }
}
