const fetch = require( "../http/fetch" );
const Agent = require( "../http/agent" );
const result = require( "../result" );
const xml = require( "fast-xml-parser" );

// NOTE API reference: https://www.namesilo.com/api_reference.php#changeNameServers

module.exports = class Namesilo {
    #apiKey;
    #proxy;
    #agent;

    constructor ( apiKey, options = {} ) {
        this.#apiKey = Array.isArray( apiKey ) ? apiKey : [apiKey];

        this.#proxy = options.proxy;
    }

    // up to 200 domains
    async checkDomains ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [domains];

        const idx = Object.fromEntries( domains.map( domain => [domain, false] ) );

        const url = `https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=${this._apiKey}&domains=` + Object.keys( idx ).join( "," );

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        for ( const domain of data.namesilo.reply.available.domain ) {
            idx[domain] = true;
        }

        return result( 200, idx );
    }

    async listDomains () {
        const url = `https://www.namesilo.com/api/listDomains?version=1&type=xml&key=${this._apiKey}`;

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        return result( 200, data.namesilo.reply.domains.domain );
    }

    async listOrders () {
        const url = `https://www.namesilo.com/api/listOrders?version=1&type=xml&key=${this._apiKey}`;

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        return result( 200, data.namesilo.reply.order || [] );
    }

    async getDomainInfo ( domain ) {
        const url = `https://www.namesilo.com/api/getDomainInfo?version=1&type=xml&key=${this._apiKey}&domain=${domain}`;

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        return result( 200, data.namesilo.reply );
    }

    async changeNameServers ( domain, nameServers ) {
        const url =
            `https://www.namesilo.com/api/changeNameServers?version=1&type=xml&key=${this._apiKey}&domain=${domain}&` +
            Object.keys( nameServers )
                .map( ns => ns + "=" + nameServers[ns] )
                .join( "&" );

        const res = await fetch( url, { "agent": this._agent.nodeFetchAgent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        return result( 200 );
    }

    get _apiKey () {
        const apiKey = this.#apiKey.shift();

        this.#apiKey.push( apiKey );

        return apiKey;
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
