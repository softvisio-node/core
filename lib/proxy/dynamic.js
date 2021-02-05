const { Proxy } = require( "../proxy" );

module.exports = class ProxyDynamic extends Proxy {
    #isHttp = false;
    #isSocks = false;

    #proxies = {};
    #httpProxies = [];
    #socksProxies = [];

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
        this.#httpProxies = [];
        this.#socksProxies = [];
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
                this.#httpProxies.push( proxy );
            }

            if ( proxy.isSocks ) {
                this.#socksProxies.push( proxy );
            }
        }

        if ( this.#httpProxies.length ) this.#isHttp = true;
        if ( this.#socksProxies.length ) this.#isSocks = true;
    }
};
