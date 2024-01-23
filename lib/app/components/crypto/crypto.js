import crypto from "node:crypto";

const aesAlgorithm = "aes-256-cbc";

export default class Env {
    #app;
    #config;
    #privateKeyPath;
    #privateKey;
    #publicKey;
    #aesKey;
    #aesIv;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get privateKey () {
        return this.#privateKey;
    }

    get publicKey () {
        return this.#publicKey;
    }

    get aesAlgorithm () {
        return aesAlgorithm;
    }

    get aesKey () {
        return this.#aesKey;
    }

    get aesIv () {
        return this.#aesIv;
    }

    // public
    async init () {
        this.#privateKey = crypto.createPrivateKey( {
            "key": this.#config.privateKey,
        } );

        if ( this.#privateKey.asymmetricKeyType !== "rsa" ) {
            return result( [400, `RSA private key is required`] );
        }

        this.#publicKey = crypto.createPublicKey( {
            "key": this.#privateKey,
        } );

        const key = this.#privateKey.export( {
            "type": "pkcs8",
            "format": "der",
        } );

        this.#aesKey = crypto.createHash( "sha256" ).update( key ).digest();

        this.#aesIv = crypto.createHash( "sha256" ).update( key ).digest();

        return result( 200 );
    }

    encrypt ( data, { encoding } = {} ) {
        const cipher = crypto.createCipheriv( aesAlgorithm, this.#aesKey, this.#aesIv );

        cipher.update( data );

        return cipher.final( encoding );
    }

    decrypt ( data, { encoding } = {} ) {
        const cipher = crypto.createDecipheriv( aesAlgorithm, this.#aesKey, this.#aesIv );

        cipher.update( data );

        return cipher.final( encoding );
    }

    publicEncrypt ( data ) {
        return crypto.publicEncrypt( this.publicKey, data );
    }

    privateDecrypt ( data ) {
        return crypto.privateDecrypt( this.privateKey, data );
    }
}
