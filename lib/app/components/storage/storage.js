import crypto from "node:crypto";

const HASH_ALGORYTM = "SHA3-512",
    HASH_ENCODING = "hex";

export default class Storage {
    #app;
    #config;
    #dbh;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    // public
    async init () {
        var res;

        res = await this._init();
        if ( !res.ok ) return res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX register http server location
    // XXX run cleanup cron
    async run () {
        var res;

        res = await this._run();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    // private
    #getHash ( file ) {
        return new Promise( resolve => {
            const hash = crypto
                .createHash( HASH_ALGORYTM )
                .setEncoding( HASH_ENCODING )
                .on( "finish", () => resolve( hash.read() ) );

            file.stream()().pipe( hash );
        } );
    }
}
