import LocalCryptoStorage from "./crypto/storage/local.js";
import RemoteCryptoStorage from "./crypto/storage/remote.js";

export default class Env {
    #app;
    #config;
    #storage;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    async init () {

        // create storage
        if ( this.#config.useLocalStorage || !this.app.dbh ) {
            this.#storage = new LocalCryptoStorage( this, this.#config.key );
        }
        else {
            this.#storage = new RemoteCryptoStorage( this, this.#config.key );
        }

        var res;

        // init storage
        res = await this.#storage.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    encrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#storage.encrypt( data, { inputEncoding, outputEncoding } );
    }

    decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#storage.decrypt( data, { inputEncoding, outputEncoding } );
    }
}
