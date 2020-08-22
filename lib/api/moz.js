const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const _proxy = require( "@softvisio/core/proxy" );
const { sleep } = require( "@softvisio/core/util" );
const result = require( "@softvisio/core/result" );
const MaxThreads = require( "@softvisio/core/threads/max-threads" );

// NOTE https://moz.com/help/links-api, click on "making calls" to open api endpoints

module.exports = class Moz extends MaxThreads {
    #apiUser;
    #apiKey;

    #proxy;
    #free; // free or paid api
    #useInterval; // use interval between requests, used for moz free api account
    #interval = 10000; // interval between requests, used for moz free api account

    #agent;
    #auth;
    #lastReqTime;

    constructor ( apiUser, apiKey, options = {} ) {
        super();

        this.#apiUser = apiUser;
        this.#apiKey = apiKey;

        this.proxy = options.proxy;
        this.#free = options.free;
        this.#useInterval = this.#free ? true : options.useInterval == null ? false : options.useInterval;

        this.maxThreads = this.#free ? 1 : options.maxThreads || 5;
    }

    set proxy ( proxy ) {
        if ( !proxy ) {
            this.#proxy = null;
        }
        else {
            this.#proxy = _proxy( proxy );
        }
    }

    get _agent () {
        if ( !this.#agent ) {
            this.#agent = new Agent( {
                "proxy": this.#proxy,
            } );
        }

        return this.#agent;
    }

    get _auth () {
        if ( !this.#auth ) this.#auth = "Basic " + Buffer.from( this.#apiUser + ":" + this.#apiKey ).toString( "base64" );

        return this.#auth;
    }

    async test () {
        return result( await this.getUrlMetrics( "www.google.com" ) );
    }

    // https://moz.com/help/links-api/making-calls/url-metrics
    // urls - up to 50 urls
    // da = domain_authority - Domain Authority, a normalized 100-point score representing the likelihood of a domain to rank well in search engine results
    // pa = page_authority - Page Authority, a normalized 100-point score representing the likelihood of a page to rank well in search engine results
    async getUrlMetrics ( url, options = {} ) {
        return this.runThread( "url_metrics", {
            "targets": Array.isArray( url ) ? url : [url],
        } );
    }

    async _thread ( endpoint, params ) {
        if ( this.#useInterval ) {
            const timeout = this.#lastReqTime + this.#interval - new Date().getTime();

            if ( timeout > 0 ) await sleep( timeout );
        }

        // XXX
        console.log( "--- run req" );

        const res = await fetch( "https://lsapi.seomoz.com/v2/" + endpoint, {
            "method": "POST",
            "agent": this._agent.nodeFetchAgent,
            "headers": { "Authorization": this._auth },
            "body": JSON.stringify( params ),
        } );

        this.#lastReqTime = new Date().getTime();

        if ( !res.ok ) {
            const data = await res.json();

            return result( [res.status, data.message || res.reason] );
        }
        else {
            const data = await res.json();

            return result( 200, data );
        }
    }
};
