require( "@softvisio/core" );
const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const RotatingMixin = require( "../mixins/rotating" );
const CountryMixin = require( "../mixins/country" );

module.exports = class ProxyLocal extends mixins( RotatingMixin, CountryMixin, Proxy ) {
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

    // POOL
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

    deleteProxy ( proxy ) {
        if ( !this.#proxies.has( proxy ) ) return;

        this.#proxies.delete( proxy );

        if ( proxy.isHttp ) this.#httpProxies--;
        if ( proxy.isSocks ) this.#socksProxies--;

        for ( const id in this.#index ) {
            const index = this.#index[id];

            for ( let n = 0; n < index.length; n++ ) {
                if ( index[n] === proxy ) {
                    index.splice( n, 1 );

                    if ( !index.length ) delete this.#index[id];

                    break;
                }
            }
        }

        this._updated();
    }

    // CONNECT
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const proxy = await this.getProxy( { "protocol": url.protocol } );

        if ( !proxy ) return Promise.reject( "Unable to get proxy" );

        if ( this._rotateCurrentProxy() ) {
            if ( this.random ) {
                await this.rotateRandomProxy( { "protocol": url.protocol } );
            }
            else {
                await this.rotateNextProxy( { "protocol": url.protocol } );
            }
        }

        return proxy.connect( url );
    }

    // ROTATE
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

    // PRIVATE
    #addProxyToIndex ( proxy, options = {} ) {
        const key = this.#buildIndexKey( options );

        this.#index[key] ||= [];

        this.#index[key].push( proxy );
    }

    #buildIndexKey ( options = {} ) {

        // for non-http connections we require socks proxy
        const type = !options.protocol || options.protocol === "http:" || options.protocol === "https:" ? "" : "socks";

        const country = options.country ? options.country.toUpperCase() : options.country ?? this.country;

        return type + "/" + country;
    }
};
