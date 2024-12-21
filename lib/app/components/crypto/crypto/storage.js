import crypto from "node:crypto";

const MASTER_KEY_ID = -1;

export class CryptoStorage {
    #crypto;
    #key;
    #keys;

    constructor ( crypto, key ) {
        this.#crypto = crypto;
        this.#key = key;
    }

    // properties
    get app () {
        return this.#crypto.app;
    }

    get crypto () {
        return this.#crypto;
    }

    // public
    async init () {

        // create master key
        this.#key = {
            "id": MASTER_KEY_ID,
            "key": crypto.createSecretKey( this.#key, "base64url" ),
        };

        if ( this.#key.symmetricKeyType !== "secret" || this.#key.symmetricKeySize !== 32 ) {
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

    // XXX
    async loadKeys () {
        var res;

        res = await this._loadKeys();
        if ( !res.ok ) return res;

        this.#keys = {};

        if ( res.data ) {
            for ( const key of res.data ) {
                key.key = crypto.createSecretKey( this.#crypto.decrypt( key.key, {
                    "inputEncoding": "base64url",
                } ) );
            }
        }

        return result( 200 );
    }

    getMasterKey () {
        return this.#key;
    }

    // XXX
    getDefaultSymmetricKey () {}

    getSymmetricKey ( id ) {
        if ( id === MASTER_KEY_ID ) {
            return this.#key.key;
        }
        else {
            return this.#keys[ id ]?.key;
        }
    }

    // XXX
    async createDefaultAesKey () {
        return new Promise( resolve => {
            crypto.generateKey(
                "aes",
                {
                    "length": 256,
                },
                ( e, key ) =>
                    resolve( key
                        .export( {
                            "format": "buffer",
                        } )
                        .toString( "base64url" ) )
            );
        } );
    }
}
