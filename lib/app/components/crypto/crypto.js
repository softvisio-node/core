import crypto from "node:crypto";

export default class Env {
    #app;
    #config;
    #privateKeyPath;
    #privateKey;
    #publicKey;

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

        return result( 200 );
    }

    encrypt ( data ) {
        return crypto.publicEncrypt( this.publicKey, data );
    }

    decrypt ( data ) {
        return crypto.privateDecrypt( this.privateKey, data );
    }
}
