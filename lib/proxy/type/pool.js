require( "#index" );

const mixins = require( "#lib/mixins" );
const Pool = require( "../pool" );
const Proxy = require( "#lib/proxy" );

const OptionsCountry = require( "../mixins/country" );
const OptionsSession = require( "../mixins/session" );

module.exports = class ProxyPool extends mixins( OptionsCountry, OptionsSession, Pool ) {
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

    // protected
    _buildProxy ( cache ) {
        const options = cache.options;

        var proxy;

        if ( options.session ) proxy = this.#proxies.getRandomValue();
        else proxy = this.#proxies[0];

        return this.#buildProxy( cache, proxy );
    }

    _buildNextProxy ( cache, auto ) {
        if ( auto ) {
            cache.autoIndex = this.#getNextIndex( cache.autoIndex );

            return this.#buildProxy( cache, this.#proxies[cache.autoIndex] );
        }
        else {
            cache.manualIndex = this.#getNextIndex( cache.manualIndex );

            return this.#buildProxy( cache, this.#proxies[cache.manualIndex] );
        }
    }

    _buildRandomProxy ( cache, auto ) {
        return this.#buildProxy( cache, this.#proxies.getRandomValue() );
    }

    // private
    #getNextIndex ( index ) {
        if ( index == null ) index = -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        return index;
    }

    #buildProxy ( cache, proxy ) {
        if ( !proxy ) return;

        return proxy.getProxy( cache.options );
    }

    #addProxies ( proxies ) {
        this.#proxies.push( ...proxies.map( proxy => Proxy.new( proxy ) ) );
    }
};
