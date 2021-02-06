require( "@softvisio/core" );
const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const RotatingMixin = require( "../mixins/rotating" );
const CountryMixin = require( "../mixins/country" );

module.exports = class ProxyPool extends mixins( RotatingMixin, CountryMixin, Proxy ) {
    #isHttp = false;
    #isSocks = false;

    #proxies = new Set();
    #httpProxies = 0;
    #socksProxies = 0;
    #index = {};

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.addProxies( url.searchParams.getAll( "proxy" ) );

        if ( options.proxies ) this.addProxies( options.proxies );
    }

    get isHttp () {
        return !!this.#httpProxies;
    }

    get isSocks () {
        return !!this.#socksProxies;
    }

    get url () {
        const url = super.url;

        for ( const proxy of this.#proxies.values() ) {
            url.searchParams.append( "proxy", proxy.toString() );
        }

        return url;
    }

    clearProxies () {
        this.#proxies = new Set();

        this.#httpProxies = 0;
        this.#socksProxies = 0;

        this.#index = {};

        this._updated();
    }

    setProxies ( proxies ) {
        this.clearProxies();

        this.addProxies( proxies );
    }

    addProxies ( proxies ) {
        if ( !proxies ) return;

        for ( const proxy of proxies ) {
            this.addProxy( proxy );
        }
    }

    addProxy ( proxy ) {
        proxy = Proxy.new( proxy );

        // proxy already added
        if ( this.#proxies.has( proxy ) ) return;

        this.#proxies.add( proxy );

        const country = proxy.country || "";

        this.#addProxyToIndex( proxy, { "country": "" } );
        if ( country ) this.#addProxyToIndex( proxy, { country } );

        if ( proxy.isHttp ) this.#httpProxies++;

        if ( proxy.isSocks ) {
            this.#socksProxies++;

            this.#addProxyToIndex( proxy, { "protocol": "socks:", "country": "" } );
            if ( country ) this.#addProxyToIndex( proxy, { "protocol": "socks:", country } );
        }

        this._updated();
    }

    #addProxyToIndex ( proxy, options = {} ) {
        const key = this.#buildIndexKey( options );

        this.#index[key] ||= [];

        this.#index[key].push( proxy );
    }

    deleteProxy ( proxy ) {
        if ( !this.#proxies.has( proxy ) ) return;

        this.#proxies.delete( proxy );

        if ( proxy.isHttp ) this.#httpProxies--;
        if ( proxy.isSocks ) this.#socksProxies--;

        for ( const index in this.#index.values() ) {
            for ( let n = 0; n < index.length; n++ ) {
                if ( index[n] === proxy ) {
                    index.splice( n, 1 );

                    break;
                }
            }
        }

        this._updated();
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        var proxy;

        if ( this._needRotate ) {
            if ( this.random ) {
                proxy = await this.rotateRandomProxy( { "protocol": url.protocol } );
            }
            else {
                proxy = await this.rotateNextProxy( { "protocol": url.protocol } );
            }
        }
        else {
            proxy = await this.getProxy( { "protocol": url.protocol } );
        }

        if ( !proxy ) return Promise.reject( "Unable to get proxy" );

        return proxy.connect( url );
    }

    #buildIndexKey ( options = {} ) {

        // for non-http connections we require socks proxy
        const type = !options.protocol || options.protocol === "http:" || options.protocol === "https:" ? "" : "socks";

        const country = options.country ? options.country.toUpperCase() : options.country ?? this.country;

        return type + "/" + country;
    }

    async getProxy ( options = {} ) {
        const key = this.#buildIndexKey( options );

        const index = this.#index[key];

        if ( !index ) return;

        return index[0];
    }

    async getRandomProxy ( options = {} ) {
        const key = this.#buildIndexKey( options );

        const index = this.#index[key];

        if ( !index ) return;

        return index.randomValue();
    }

    async rotateNextProxy ( options = {} ) {
        const key = this.#buildIndexKey( options );

        const index = this.#index[key];

        if ( !index ) return;

        // rotate proxy
        const proxy = index.shift();
        index.push( proxy );

        if ( this._rotated ) this._rotated();

        return index[0];
    }

    async rotateRandomProxy ( options = {} ) {
        const key = this.#buildIndexKey( options );

        const index = this.#index[key];

        if ( !index ) return;

        if ( index.length === 0 ) return;

        if ( index.length === 1 ) return index[0];

        const first = index.shift();

        index.unshift( index.splice( index.randomIndex(), 1 )[0], first );

        return index[0];
    }
};
