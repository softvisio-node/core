require( "#index" );

const fetch = require( "../http/fetch" );
const xml = require( "fast-xml-parser" );
const Semaphore = require( "../threads/semaphore" );

// NOTE API reference: https://www.namesilo.com/api_reference.php#changeNameServers

// XXX max threads / api key !!!

module.exports = class Namesilo extends Semaphore {
    #apiKey;
    #_agent;

    constructor ( apiKey, options = {} ) {
        super();

        this.#apiKey = Array.isArray( apiKey ) ? apiKey : [apiKey];

        this.proxy = options.proxy;

        this.maxThreads = options.maxThreads || 2;
    }

    set proxy ( proxy ) {
        this.#agent.proxy = proxy;
    }

    get _apiKey () {
        const apiKey = this.#apiKey.shift();

        this.#apiKey.push( apiKey );

        return apiKey;
    }

    get #agent () {
        if ( !this.#_agent ) this.#_agent = new fetch.Agent();

        return this.#_agent;
    }

    // up to 200 domains
    async checkDomains ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [domains];

        const idx = Object.fromEntries( domains.map( domain => [domain, false] ) );

        const url = `https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=${this._apiKey}&domains=` + Object.keys( idx ).join( "," );

        const res = await this.runThread( "_thread", url );

        if ( !res.ok ) return res;

        for ( const domain of res.data.available.domain ) {
            idx[domain] = true;
        }

        return result( 200, idx );
    }

    async listDomains () {
        const url = `https://www.namesilo.com/api/listDomains?version=1&type=xml&key=${this._apiKey}`;

        const res = await this.runThread( "_thread", url );

        if ( !res.ok ) return res;

        return result( 200, res.data.domains.domain );
    }

    async listOrders () {
        const url = `https://www.namesilo.com/api/listOrders?version=1&type=xml&key=${this._apiKey}`;

        const res = await this.runThread( "_thread", url );

        if ( !res.ok ) return res;

        return result( 200, res.data.order || [] );
    }

    async getDomainInfo ( domain ) {
        const url = `https://www.namesilo.com/api/getDomainInfo?version=1&type=xml&key=${this._apiKey}&domain=${domain}`;

        return await this.runThread( "_thread", url );
    }

    // NAME SERVERS
    async listRegisteredNameServers ( domain ) {
        const url = `https://www.namesilo.com/api/listRegisteredNameServers?version=1&type=xml&key=${this._apiKey}&domain=${domain}`;

        const res = await this.runThread( "_thread", url );

        if ( !res.ok ) return res;

        return result( 200, res.data.hosts );
    }

    async addRegisteredNameServer ( domain, newHost, ip1, options = {} ) {
        const ip = { ...options, ip1 };

        const url =
            `https://www.namesilo.com/api/addRegisteredNameServer?version=1&type=xml&key=${this._apiKey}&domain=${domain}&new_host=${newHost}&` +
            Object.keys( ip )
                .map( name => name + "=" + ip[name] )
                .join( "&" );

        return await this.runThread( "_thread", url );
    }

    async modifyRegisteredNameServer ( domain, currentHost, newHost, ip1, options = {} ) {
        const ip = { ...options, ip1 };

        const url =
            `https://www.namesilo.com/api/modifyRegisteredNameServer?version=1&type=xml&key=${this._apiKey}&domain=${domain}&current_host=${currentHost}&new_host=${newHost}&` +
            Object.keys( ip )
                .map( name => name + "=" + ip[name] )
                .join( "&" );

        return await this.runThread( "_thread", url );
    }

    async deleteRegisteredNameServer ( domain, currentHost ) {
        const url = `https://www.namesilo.com/api/deleteRegisteredNameServer?version=1&type=xml&key=${this._apiKey}&domain=${domain}&current_host=${currentHost}`;

        return await this.runThread( "_thread", url );
    }

    async changeNameServers ( domain, nameServers ) {
        const url =
            `https://www.namesilo.com/api/changeNameServers?version=1&type=xml&key=${this._apiKey}&domain=${domain}&` +
            Object.keys( nameServers )
                .filter( ns => nameServers[ns] )
                .map( ns => ns + "=" + nameServers[ns] )
                .join( "&" );

        return await this.runThread( "_thread", url );
    }

    async _thread ( url ) {
        const res = await fetch( url, { "agent": this.#agent } );

        if ( !res.ok ) return result( [res.status, res.statusText] );

        const data = xml.parse( await res.text() );

        if ( data.namesilo.reply.code !== 300 ) return result( [400, data.namesilo.reply.detail] );

        return result( 200, data.namesilo.reply );
    }
};
