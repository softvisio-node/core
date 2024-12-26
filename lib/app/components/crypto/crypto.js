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

        // XXX -------------
        // res = await this.revokeKey();
        // console.log( res );

        res = await this.revokeMasterKey();
        console.log( res );

        res = await this.revokeMasterKey();
        console.log( res );

        // res = await this.revokeKey();
        // console.log( res );

        process.exit();

        // XXX -------------

        return result( 200 );
    }

    async encrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#storage.encrypt( data, { inputEncoding, outputEncoding } );
    }

    async decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#storage.decrypt( data, { inputEncoding, outputEncoding } );
    }

    async revokeKey () {
        return this.#storage.revokeKey();
    }

    async revokeMasterKey ( masterKey ) {
        return this.#storage.revokeMasterKey( masterKey );
    }
}
