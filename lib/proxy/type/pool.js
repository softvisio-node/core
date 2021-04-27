require( "#index" );

const mixins = require( "#lib/mixins" );
const Pool = require( "../pool" );
const Proxy = require( "#lib/proxy" );

const OptionsCountry = require( "../mixins/country" );
const OptionsResolveRemote = require( "../mixins/resolve-remote" );
const OptionsSession = require( "../mixins/session" );

module.exports = class ProxyPool extends mixins( OptionsCountry, OptionsResolveRemote, OptionsSession, Pool ) {
    #proxies = [];

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.#addProxies( url.searchParams.getAll( "proxy" ) );

        if ( options.proxies ) this.#addProxies( options.proxies );
    }

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get url () {
        const url = super.url;

        if ( this.#proxies.length ) url.searchParams.set( "proxy", this.#proxies );

        return url;
    }

    // upstream
    async getProxy ( options ) {
        const cache = this._getBucket( options );

        var proxy = await super._getProxy( cache );

        if ( proxy ) proxy = await proxy.getProxy( cache.options );

        return proxy;
    }

    async getNextProxy ( options ) {
        const cache = this._getBucket( options );

        var proxy = await super._getNextProxy( cache );

        if ( proxy ) proxy = await proxy.getProxy( cache.options );

        return proxy;
    }

    async getRandomProxy ( options ) {
        const cache = this._getBucket( options );

        var proxy = await super._getRandomProxy( cache );

        if ( proxy ) proxy = await proxy.getProxy( cache.options );

        return proxy;
    }

    // protected
    _buildProxy ( cache ) {
        return this.#proxies[0];
    }

    _buildNextProxy ( cache, auto ) {
        if ( auto ) {
            cache.autoIndex = this.#getNextIndex( cache.autoIndex );

            return this.#proxies[cache.autoIndex];
        }
        else {
            cache.manualIndex = this.#getNextIndex( cache.manualIndex );

            return this.#proxies[cache.manualIndex];
        }
    }

    _buildRandomProxy ( cache, auto ) {
        return this.#proxies.getRandomValue();
    }

    // private
    #getNextIndex ( index ) {
        if ( index == null ) index = -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        return index;
    }

    #addProxies ( proxies ) {
        this.#proxies.push( ...proxies.map( proxy => Proxy.new( proxy ) ) );
    }
};
