const { Proxy } = require( "../proxy" );

module.exports = class ProxyDynamic extends Proxy {
    #proxies = [];

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );
    }

    get isStatic () {
        return false;
    }

    get isDynamic () {
        return true;
    }

    _setProxies ( proxies ) {
        this.#proxies = [];

        this._addProxies( proxies );
    }

    _addProxies ( proxies ) {
        if ( !proxies ) return;

        for ( let proxy of proxies ) {
            proxy = Proxy.new( proxy );

            this.#proxies.push( proxy );
        }
    }
};
