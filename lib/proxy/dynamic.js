const { Proxy } = require( "../proxy" );

module.exports = class ProxyDynamic extends Proxy {
    #isHttp = false;
    #isSocks = false;

    #proxies = {};

    #proxyByType = {
        "http": [],
        "socks": [],
    };

    #proxyByCountry = {
        "http": {},
        "socks": {},
    };

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

        this.#proxyByType = {
            "http": [],
            "socks": [],
        };

        this.#proxyByCountry = {
            "http": {},
            "socks": {},
        };
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

            if ( proxy.isHttp ) {
                this.#proxyByType.http.push( proxy );
            }

            if ( proxy.isSocks ) {
                this.#proxyByType.socks.push( proxy );
            }
        }

        if ( this.#proxyByType.http.length ) this.#isHttp = true;
        if ( this.#proxyByType.socks.length ) this.#isSocks = true;
    }

    // XXX
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( !type ) return Promise.reject( "Unable to select connection type" );

        const proxy = this.#proxyByType[type].shift();

        if ( !proxy ) return Promise.reject( "Unable to select connection type" );

        this.#proxyByType[type].push( proxy );

        return proxy.connect( url );
    }
};
