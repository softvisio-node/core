import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc",
    TYPE = "aes-cbc";

export default class Env {
    #app;
    #config;
    #privateKey;
    #publicKey;
    #key;
    #iv;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

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

        if ( this.#privateKey.asymmetricKeyType !== "rsa" || this.#privateKey.asymmetricKeyDetails.modulusLength < 2048 ) {
            return result( [ 400, `Private RSA key minimum 2048 bits length is required` ] );
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

    createCipher () {
        return crypto.createCipheriv( ALGORITHM, this.#key, this.#iv );
    }

    createDecipher () {
        return crypto.createDecipheriv( ALGORITHM, this.#key, this.#iv );
    }

    encrypt ( data, { encoding } = {} ) {
        if ( data == null ) return null;

        const cipher = this.createCipher();

        return Buffer.concat( [

            //
            cipher.update( data, encoding ),
            cipher.final(),
        ] );
    }

    decrypt ( data, { encoding } = {} ) {
        if ( data == null ) return null;

        const cipher = this.createDecipher();

        return Buffer.concat( [

            //
            cipher.update( data, encoding ),
            cipher.final(),
        ] );
    }

    publicEncrypt ( data ) {
        if ( data == null ) return null;

        return crypto.publicEncrypt( this.publicKey, data );
    }

    privateDecrypt ( data ) {
        if ( data == null ) return null;

        return crypto.privateDecrypt( this.privateKey, data );
    }
}
