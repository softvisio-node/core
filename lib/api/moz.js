const fetch = require( "../http/fetch" );
const { sleep } = require( "../util" );
const result = require( "../result" );
const MaxThreads = require( "../threads/mixins/max-threads" );

// NOTE https://moz.com/help/links-api, click on "making calls" to open api endpoints

module.exports = class Moz extends MaxThreads() {
    #apiUser;
    #apiKey;

    #free; // free or paid api
    #useInterval; // use interval between requests, used for moz free api account
    #interval = 10000; // interval between requests, used for moz free api account

    #_agent;
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
        this.#agent.proxy = proxy;
    }

    get #agent () {
        if ( !this.#_agent ) this.#_agent = new fetch.Agent();

        return this.#_agent;
    }

    get _auth () {
        if ( !this.#auth ) this.#auth = "Basic " + Buffer.from( this.#apiUser + ":" + this.#apiKey ).toString( "base64" );

        return this.#auth;
    }

    async test () {
        return result( await this.getUrlMetrics( "www.google.com" ) );
    }

    // https://moz.com/help/links-api/making-calls/anchor-text-metrics
    // scope: page, subdomain, root_domain
    // limit: 1-50
    async getAnchorText ( target, scope, options = {} ) {
        return this.runThread( "_thread", "anchor_text", { target, scope, "limit": options.limit || null } );
    }

    // XXX https://moz.com/help/links-api/making-calls/final-redirect
    async getFinalRedirect () {}

    // XXX https://moz.com/help/links-api/making-calls/global-top-pages
    async getGlobalTopPages () {}

    // XXX https://moz.com/help/links-api/making-calls/global-top-root-domains
    async getGlobalTopRootDomains () {}

    // XXX https://moz.com/help/links-api/making-calls/index-metadata
    async getIndexMetadata () {}

    // https://moz.com/help/links-api/making-calls/link-intersect
    async getLinkIntersect () {}

    // XXX https://moz.com/help/links-api/making-calls/link-status
    async getLinkStatus () {}

    // XXX https://moz.com/help/links-api/making-calls/linking-root-domains
    async getLinkingRootDomains () {}

    // XXX https://moz.com/help/links-api/making-calls/link-metrics
    async getLinks () {}

    // XXX https://moz.com/help/links-api/making-calls/top-pages-metrics
    async getTopPages () {}

    // https://moz.com/help/links-api/making-calls/url-metrics
    // urls - up to 50 urls
    // da = domain_authority - Domain Authority, a normalized 100-point score representing the likelihood of a domain to rank well in search engine results
    // pa = page_authority - Page Authority, a normalized 100-point score representing the likelihood of a page to rank well in search engine results
    async getUrlMetrics ( url, options = {} ) {
        return this.runThread( "_thread", "url_metrics", {
            "targets": Array.isArray( url ) ? url : [url],
        } );
    }

    // XXX https://moz.com/help/links-api/making-calls/usage-data
    async getUsageData () {}

    async _thread ( endpoint, params ) {
        if ( this.#useInterval ) {
            const timeout = this.#lastReqTime + this.#interval - new Date().getTime();

            if ( timeout > 0 ) await sleep( timeout );
        }

        const res = await fetch( "https://lsapi.seomoz.com/v2/" + endpoint, {
            "method": "POST",
            "agent": this.#agent.fetchAgent,
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
