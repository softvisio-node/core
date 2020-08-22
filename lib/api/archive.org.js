const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const _proxy = require( "../proxy" );
const result = require( "../result" );
const MaxThreads = require( "../threads/max-threads" );

module.exports = class ArchiveOrg extends MaxThreads {
    #proxy;
    #agent;

    constructor ( options = {} ) {
        super();

        this.proxy = options.proxy;

        this.maxThreads = options.maxThreads || 10;
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

    // fields: "urlkey","timestamp","original","mimetype","statuscode","digest","length"
    async getIndex ( domain, options = {} ) {
        const url = `https://web.archive.org/cdx/search/cdx?url=${domain}&matchType=exact&fl=timestamp&filter=statuscode:200&filter=mimetype:text/html&output=json&from=2010&collapse=timestamp:6`;

        const res = await this.runThread( url );

        if ( !res.ok ) return res;

        res.data = JSON.parse( res.data );

        const header = res.data.shift();

        res.data = res.data.map( item => Object.fromEntries( item.map( ( field, idx ) => [header[idx], field] ) ) );

        return res;
    }

    async getSnapshot ( domain, timestamp ) {
        const url = `https://web.archive.org/web/${timestamp}/${domain}/`;

        return await this.runThread( url );
    }

    async _thread ( url ) {
        const res = await fetch( url, {
            "agent": this._agent.nodeFetchAgent,
        } );

        if ( res.ok ) {
            const data = await res.text();

            return result( 200, data );
        }
        else {
            return result( [res.status, res.reason] );
        }
    }
};
