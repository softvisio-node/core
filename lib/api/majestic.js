require( "#index" );

const fetch = require( "../http/fetch" );
const Semaphore = require( "../threads/semaphore" );

module.exports = class Majestic extends Semaphore {
    #apiKey; // direct access to the API, access is restricted by IP address
    #openappAccessToken; // OpenApp access, user key, identify user
    #openappPrivateKey; // OpenApp access, application vendor key, identify application
    #_agent;

    constructor ( options ) {
        super();

        this.#apiKey = options.apiKey;
        this.#openappAccessToken = options.openappAccessToken;
        this.#openappPrivateKey = options.openappPrivateKey;

        this.proxy = options.proxy;

        this.maxThreads = options.maxThreads || 3;
    }

    set proxy ( proxy ) {
        this.#agent.proxy = proxy;
    }

    get #agent () {
        if ( !this.#_agent ) this.#_agent = new fetch.Agent();

        return this.#_agent;
    }

    async test () {
        return result( await this.getSubscriptionInfo() );
    }

    // https://developer-support.majestic.com/api/commands/get-anchor-text.shtml
    // each request costs 1000 AnalysisResUnits, no matter how much anchors requested, each request costs 0.004$ at 01.04.2020
    async getAnchorText ( domain, options = {} ) {
        const params = {
            "cmd": "GetAnchorText",
            "datasource": "fresh",
            "item": domain,
            "Count": options.count || 10, // Number of results to be returned back. Def. 10, max. 1_000
            "TextMode": 0,
            "Mode": 0,
            "FilterAnchorText": "",
            "FilterAnchorTextMode": 0,
            "FilterRefDomain": "",
            "UsePrefixScan": 0,
        };

        return await this.runThread( "_thread", params );
    }

    // https://developer-support.majestic.com/api/commands/get-index-item-info.shtml
    // items - up to 100 items
    // each domain in request costs 1 IndexItemInfoResUnits, or 0.0008$ at 01.04.2020
    async getIndexItemInfo ( items, options = {} ) {
        if ( !Array.isArray( items ) ) items = [items];

        const params = {
            "cmd": "GetIndexItemInfo",
            "items": items.length,
        };

        if ( options.datasource ) params.datasource = options.datasource;
        if ( options.desiredTopics ) params.DesiredTopics = options.desiredTopics;
        if ( options.addAllTopics ) params.AddAllTopics = 1;
        if ( options.enableResourceUnitFailover ) params.EnableResourceUnitFailover = 1;

        for ( let i = 0; i < items.length; i++ ) {
            params["item" + i] = items[i];
        }

        return await this.runThread( "_thread", params );
    }

    // https://developer-support.majestic.com/api/commands/get-back-link-data.shtml
    // XXX - add all params
    async getBacklinkData ( item, options = {} ) {
        const params = {
            "cmd": "GetBackLinkData",
            item,
        };

        if ( options.datasource ) params.datasource = options.datasource;
        if ( options.count ) params.Count = options.count;
        if ( options.from ) params.From = options.from;
        if ( options.mode ) params.Mode = 1;
        if ( options.showDomainInfo ) params.ShowDomainInfo = 1;

        return await this.runThread( "_thread", params );
    }

    // https://developer-support.majestic.com/api/commands/get-subscription-info.shtml
    // this request is free
    async getSubscriptionInfo ( options = {} ) {
        const params = {
            ...options,
            "cmd": "GetSubscriptionInfo",
        };

        return await this.runThread( "_thread", params );
    }

    async _thread ( params ) {
        let url = "https://api.majestic.com/api/json?";

        if ( this.#apiKey ) {
            url += `app_api_key=${this.#apiKey}&`;
        }
        else if ( this.#openappPrivateKey && this.#openappAccessToken ) {
            url += `accesstoken=${this.#openappAccessToken}&privatekey=${this.#openappPrivateKey}&`;
        }

        url += new URLSearchParams( params ).toString();

        const res = await fetch( url, {
            "agent": this.#agent,
        } );

        if ( res.ok ) {
            const data = await res.json();

            if ( data.Code !== "OK" ) {
                return result( [400, data.ErrorMessage] );
            }
            else {
                return result( 200, data );
            }
        }
        else {
            return result( [res.status, res.reason] );
        }
    }
};
