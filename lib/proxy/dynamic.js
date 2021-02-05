const { Proxy } = require( "../proxy" );

module.exports = class ProxyDynamic extends Proxy {
    #isHttp = false;
    #isSocks = false;

    #persistent;
    #timeout;
    #lastRotated;

    #proxies = {};
    #index = {};

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        this.persistent = options.persistent ?? url.searchParams.get( "persistent" ) ?? false;

        this.timeout = options.timeout ?? url.searchParams.get( "timeout" ) ?? 0;
    }

    get isHttp () {
        return this.#isHttp;
    }

    get isSocks () {
        return this.#isSocks;
    }

    get isStatic () {
        return false;
    }

    get isDynamic () {
        return true;
    }

    get persistent () {
        return this.#persistent;
    }

    set persistent ( value ) {
        this._clearUrl();

        if ( value === true || value === "true" || value === 1 ) this.#persistent = true;
        else this.#persistent = false;
    }

    get timeout () {
        return this.#timeout;
    }

    set timeout ( value ) {
        this._clearUrl();

        this.#timeout = parseInt( value );
    }

    _buildUrl () {
        const url = super._buildUrl();

        url.searchParams.set( "persistent", this.#persistent );

        url.searchParams.set( "timeout", this.#timeout );

        return url;
    }

    _clearProxies () {
        this.#isHttp = false;
        this.#isSocks = false;

        this.#proxies = {};
        this.#index = {};
    }

    _setProxies ( proxies ) {
        this._clearProxies();

        this._addProxies( proxies );
    }

    _addProxies ( proxies ) {
        if ( !proxies ) return;

        for ( let proxy of proxies ) {
            proxy = Proxy.new( proxy );

            this._addProxy( proxy );
        }
    }

    _addProxy ( proxy ) {
        if ( this.#proxies[proxy.id] ) this._deleteProxy( proxy );

        this.#proxies[proxy.id] = proxy;

        this.#index["/"] ||= new Set();
        this.#index["/"].add( proxy );

        const country = proxy.country || "";

        if ( country ) {
            this.#index["/" + country] ||= new Set();
            this.#index["/" + country].add( proxy );
        }

        if ( proxy.isHttp ) {
            this.#isHttp = true;

            this.#index["http/"] ||= new Set();
            this.#index["http/"].add( proxy );

            if ( country ) {
                this.#index["http/" + country] ||= new Set();
                this.#index["http/" + country].add( proxy );
            }
        }

        if ( proxy.isSocks ) {
            this.#isSocks = true;

            this.#index["socks/"] ||= new Set();
            this.#index["socks/"].add( proxy );

            if ( country ) {
                this.#index["socks/" + country] ||= new Set();
                this.#index["socks/" + country].add( proxy );
            }
        }
    }

    _deleteProxy ( proxy ) {
        if ( !this.#proxies[proxy.id] ) return;

        delete this.#proxies[proxy.id];

        for ( const index in this.#index ) {
            this.#index[index].delete( proxy );
        }

        this.#isHttp = this.#index["http/"] && this.#index["http/"].size ? true : false;
        this.#isSocks = this.#index["socks/"] && this.#index["socks/"].size ? true : false;
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( !type ) return Promise.reject( "Unable to select connection type" );

        const proxy = this._needRotate() ? await this.getNextProxy( { type } ) : await this.getProxy( { type } );

        if ( !proxy ) return Promise.reject( "Unable to select connection type" );

        return proxy.connect( url );
    }

    _needRotate () {
        if ( this.persistent ) return false;

        if ( this.timeout ) {
            if ( !this.#lastRotated ) return false;

            if ( new Date().getTime() - this.#lastRotated >= this.timeout ) return true;

            return false;
        }

        return true;
    }

    async getProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return index.values().next().value;
    }

    async getNextProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        const proxy = index.values().next().value;

        index.delete( proxy );

        index.add( proxy );

        this.#lastRotated = new Date();

        return proxy;
    }

    // XXX not effective
    async getRandomProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return [...index.keys()][Math.floor( Math.random() * index.size )];
    }
};
