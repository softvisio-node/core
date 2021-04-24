require( "#index" );

const mixins = require( "#lib/mixins" );
const Pool = require( "../pool" );
const Proxy = require( "#lib/proxy" );

const OptionsCountry = require( "../mixins/country" );
const OptionsSession = require( "../mixins/session" );

module.exports = class ProxyPool extends mixins( OptionsCountry, OptionsSession, Pool ) {
    #isHttp = false;
    #isSocks = false;
    #proxies = [];

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.addProxies( url.searchParams.getAll( "proxy" ) );

        if ( options.proxies ) this.addProxies( options.proxies );
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    get url () {
        const url = super.url;

        if ( this.#proxies.length ) url.searchParams.set( "proxy", this.#proxies );

        return url;
    }

    // XXX add geo support
    _buildProxy ( options = {} ) {
        if ( options.session ) return this.#proxies.getRandomValue();
        else return this.#proxies[0];
    }

    // XXX add geo support
    _rotateNextProxy ( cache ) {
        cache.index ??= -1;

        cache.index++;

        if ( cache.index >= this.#proxies.length ) cache.index = 0;

        return this.#proxies[cache.index];
    }

    // XXX add geo support
    // XXX exclude current proxy - cache.proxy
    _rotateRandomProxy ( cache ) {
        return this.#proxies.getRandomValue();
    }

    addProxies ( proxies ) {
        for ( let proxy of proxies ) {
            proxy = Proxy.new( proxy );

            if ( proxy.isHttp ) this.#isHttp = true;
            if ( proxy.isSocks ) this.#isSocks = true;

            this.#proxies.push( proxy );
        }
    }
};
