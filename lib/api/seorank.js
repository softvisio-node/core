const fetch = require( "../http/fetch" );
const Semaphore = require( "../threads/semaphore" );

// NOTE https://seo-rank.my-addr.com/how-to-use-bulk-and-api-checker.php

const DEFAULT_MAX_THREADS = 5;

module.exports = class SeoRank extends Semaphore {
    #apiKey;

    constructor ( apiKey ) {
        super();

        this.#apiKey = apiKey;

        this.maxThreads = DEFAULT_MAX_THREADS;
    }

    async test () {
        return result( await this.getMoz( "www.google.com" ) );
    }

    async getMoz ( domain ) {
        return this.runThread( "_thread", `https://seo-rank.my-addr.com/api2/moz/${this.#apiKey}/${domain}` );
    }

    // XXX up to 40 threads
    // XXX do not use this shit
    async getMajestic ( url ) {
        return this.runThread( "_thread", `https://seo-rank.my-addr.com/api3/${this.#apiKey}/${url}` );
    }

    async _thread ( url ) {
        const res = await fetch( url );

        if ( !res.ok ) return res;

        const data = await res.text();

        if ( data === "incorrect_secret" ) return result( 401 );
        else if ( data === "added" ) return result( 200, "added" );
        else if ( data === "progress" ) return result( 200, "processing" );

        return result( 200, JSON.parse( data ) );
    }
};
