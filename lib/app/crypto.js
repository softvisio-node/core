import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const DEFAULT_PRIVATE_KEY_SIZE = 4096;

export default class Env {
    #app;
    #privateKeyPath;
    #privateKey;
    #publicKey;

    constructor ( app ) {
        this.#app = app;
    }

    // properties
    get privateKeyPath () {
        this.#privateKeyPath ??= path.join( this.#app.env.dataDir, ".private.key.pem" );

        return this.#privateKeyPath;
    }

    get privateKey () {
        if ( !this.#privateKey ) this.#init();

        return this.#privateKey;
    }

    get publicKey () {
        if ( !this.#publicKey ) this.#init();

        return this.#publicKey;
    }

    // public
    encrypt ( data ) {
        return crypto.publicEncrypt( this.publicKey, data );
    }

    decrypt ( data ) {
        return crypto.privateDecrypt( this.privateKey, data );
    }

    // private
    #init () {
        if ( fs.existsSync( this.privateKeyPath ) ) {
            this.#privateKey = crypto.createPrivateKey( {
                "key": fs.readFileSync( this.privateKeyPath ),
            } );

            this.#publicKey = crypto.createPublicKey( {
                "key": this.#privateKey,
            } );
        }
        else {
            const keyOair = crypto.generateKeyPairSync( "rsa", {
                "modulusLength": DEFAULT_PRIVATE_KEY_SIZE,
            } );

            this.#privateKey = keyOair.privateKey;
            this.#publicKey = keyOair.publicKey;

            fs.writeFileSync(
                this.privateKeyPath,
                this.#privateKey.export( {
                    "type": "pkcs8",
                    "format": "pem",
                } )
            );
        }
    }
}
