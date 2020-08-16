const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const result = require( "../result" );
const xml = require( "fast-xml-parser" );

module.exports = class Namesilo {
    #apiKey;
    #proxy;
    #agent;

    constructor ( apiKey, options = {} ) {
        this.#apiKey = Array.isArray( apiKey ) ? apiKey : [apiKey];

        this.#proxy = options.proxy;
    }

    async checkDomains ( domains ) {
        const apiKey = this.#apiKey.shift();

        this.#apiKey.push( apiKey );

        if ( !Array.isArray( domains ) ) domains = [domains];

        const idx = Object.fromEntries( domains.map( domain => [domain, false] ) );

        const url = `https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=${apiKey}&domains=` + Object.keys( idx ).join( "," );

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        for ( const domain of data.namesilo.reply.available.domain ) {
            idx[domain] = true;
        }

        return result( 200, idx );
    }

    get _agent () {
        if ( !this.#agent ) {
            this.#agent = new Agent( {
                "proxy": this.#proxy,
            } );
        }

        return this.#agent;
    }
};
