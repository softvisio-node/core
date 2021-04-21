require( "@softvisio/core" );

const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsSession = require( "../mixins/options/session" );
const Pool = require( "../mixins/pool" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../mixins/upstream" );

module.exports = class ProxyPool extends mixins( OptionsCountry, OptionsSession, Pool, Rotating, Upstream, Proxy ) {
    #isHttp;
    #isSocks;
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
        return this.#proxies[0];
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
        return this.#proxies.randomValue();
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
