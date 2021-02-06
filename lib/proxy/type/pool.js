const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const RotatingMixin = require( "../mixins/rotating" );
const CountryMixin = require( "../mixins/country" );

module.exports = class ProxyPool extends mixins( RotatingMixin, CountryMixin, Proxy ) {
    #isHttp = false;
    #isSocks = false;

    #index = {
        "/": new Set(),
    };

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

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

        for ( const proxy of this.#index["/"] ) {
            url.searchParams.append( "proxy", proxy.toString() );
        }

        return url;
    }

    clearProxies () {
        this.#index = {
            "/": new Set(),
        };

        this._updated();
    }

    setProxies ( proxies ) {
        this.clearProxies();

        this.addProxies( proxies );
    }

    addProxies ( proxies ) {
        if ( !proxies ) return;

        for ( let proxy of proxies ) {
            proxy = Proxy.new( proxy );

            this._addProxy( proxy );
        }

        this._updated();
    }

    _addProxy ( proxy ) {
        this.#index["/"].add( proxy );

        const country = proxy.country || "";

        if ( country ) {
            this.#index["/" + country] ||= new Set();
            this.#index["/" + country].add( proxy );
        }

        if ( proxy.isHttp ) {
            this.#index["http/"] ||= new Set();
            this.#index["http/"].add( proxy );

            if ( country ) {
                this.#index["http/" + country] ||= new Set();
                this.#index["http/" + country].add( proxy );
            }
        }

        if ( proxy.isSocks ) {
            this.#index["socks/"] ||= new Set();
            this.#index["socks/"].add( proxy );

            if ( country ) {
                this.#index["socks/" + country] ||= new Set();
                this.#index["socks/" + country].add( proxy );
            }
        }
    }

    deleteProxy ( proxy ) {
        if ( this.#index["/"].has( proxy ) ) return;

        for ( const index in this.#index ) {
            this.#index[index].delete( proxy );
        }

        this._updated();
    }

    _updated () {
        this.#isHttp = this.#index["http/"] && this.#index["http/"].size ? true : false;
        this.#isSocks = this.#index["socks/"] && this.#index["socks/"].size ? true : false;

        super._updated();
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( !type ) return Promise.reject( "Unable to select connection type" );

        const proxy = this._needRotate && this._needRotate() ? await this.getNextProxy( { type } ) : await this.getProxy( { type } );

        if ( !proxy ) return Promise.reject( "Unable to select connection type" );

        return proxy.connect( url );
    }

    async getProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || this.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return index.values().next().value;
    }

    async getNextProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || this.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        const proxy = index.values().next().value;

        index.delete( proxy );

        index.add( proxy );

        if ( super.getNextProxy ) super.getNextProxy();

        return proxy;
    }

    // XXX not effective
    async getRandomProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || this.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return [...index.keys()][Math.floor( Math.random() * index.size )];
    }

    async getRemoteAddr () {
        return;
    }
};
