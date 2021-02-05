const { Proxy } = require( "../proxy" );

module.exports = class ProxyDynamic extends Proxy {
    #isHttp = false;
    #isSocks = false;

    #proxies = {};
    #index = {};

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );
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

    get _url () {
        const url = new URL( this.type + "://" );

        url.hostname = this.hostname;
        url.port = this.port;
        url.username = this.username;
        url.password = this.password;

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

            if ( this.#proxies[proxy.id] ) continue;

            this.#proxies[proxy.id] = proxy;

            this.#index["/"] ||= [];
            this.#index["/"].push( proxy );

            // XXX
            const country = "";

            if ( country ) {
                this.#index["/" + country] ||= [];
                this.#index["/" + country].push( proxy );
            }

            if ( proxy.isHttp ) {
                this.#index["http/"] ||= [];
                this.#index["http/"].push( proxy );

                if ( country ) {
                    this.#index["http/" + country] ||= [];
                    this.#index["http/" + country].push( proxy );
                }
            }

            if ( proxy.isSocks ) {
                this.#index["socks/"] ||= [];
                this.#index["socks/"].push( proxy );

                if ( country ) {
                    this.#index["socks/" + country] ||= [];
                    this.#index["socks/" + country].push( proxy );
                }
            }
        }

        if ( this.#index["http/"] && this.#index["http/"].length ) this.#isHttp = true;
        if ( this.#index["socks/"] && this.#index["socks/"].length ) this.#isSocks = true;
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( !type ) return Promise.reject( "Unable to select connection type" );

        const proxy = this._needRotate() ? await this.getNextProxy( { type } ) : await this.getProxy( { type } );

        if ( !proxy ) return Promise.reject( "Unable to select connection type" );

        return proxy.connect( url );
    }

    // XXX
    _needRotate () {
        return false;
    }

    async getProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return index[0];
    }

    async getNextProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        const proxy = index.shift();

        index.push( proxy );

        return proxy;
    }

    async getRandomProxy ( options = {} ) {
        const key = ( options.type || "" ) + "/" + ( options.country || "" );

        const index = this.#index[key];

        if ( !index ) return;

        return index[Math.floor( Math.random() * index.length )];
    }
};
