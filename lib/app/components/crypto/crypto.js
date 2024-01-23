import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc",
    TYPE = "aes-cbc";

export default class Env {
    #app;
    #config;
    #privateKeyPath;
    #privateKey;
    #publicKey;
    #key;
    #iv;

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

    get algorithm () {
        return ALGORITHM;
    }

    get type () {
        return TYPE;
    }

    get key () {
        return this.#key;
    }

    get iv () {
        return this.#iv;
    }

    // public
    async init () {
        this.#privateKey = crypto.createPrivateKey( {
            "key": this.#config.privateKey,
        } );

        if ( this.#privateKey.asymmetricKeyType !== "rsa" ) {
            return result( [ 400, `RSA private key is required` ] );
        }

        this.#publicKey = crypto.createPublicKey( {
            "key": this.#privateKey,
        } );

        const key = this.#privateKey.export( {
            "type": "pkcs8",
            "format": "der",
        } );

        this.#key = crypto.createHash( "sha256" ).update( key ).digest();

        this.#iv = crypto.createHash( "md5" ).update( key ).digest();

        return result( 200 );
    }

    encrypt ( data, { encoding } = {} ) {
        const cipher = crypto.createCipheriv( ALGORITHM, this.#key, this.#iv );

        return Buffer.concat( [

            //
            cipher.update( data, encoding ),
            cipher.final(),
        ] );
    }

    decrypt ( data, { encoding } = {} ) {
        const cipher = crypto.createDecipheriv( ALGORITHM, this.#key, this.#iv );

        return Buffer.concat( [

            //
            cipher.update( data, encoding ),
            cipher.final(),
        ] );
    }

    publicEncrypt ( data ) {
        return crypto.publicEncrypt( this.publicKey, data );
    }

    privateDecrypt ( data ) {
        return crypto.privateDecrypt( this.privateKey, data );
    }
}
