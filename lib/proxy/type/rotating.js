const Proxy = require( "../proxy" );
const _proxy = require( "../../proxy" );

module.exports = class ProxyTypeRotating extends Proxy {
    #proxies = [];

    constructor ( url, options = {} ) {
        if ( !( url instanceof URL ) ) url = new URL( url );

        super( url, options );

        // url.searchParams.forEach( ( value, name ) => {
        //     if ( !( name in options ) ) options[name] = value;
        // } );

        if ( options.proxies ) this.addProxies( options.proxies );
    }

    // FEATURES
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    // XXX if !static, remoteAddr and timezone returns null
    get isStatic () {
        return false;
    }

    // METHODS
    setProxies ( proxies ) {
        this.#proxies = [];

        this.addProxies( proxies );
    }

    addProxies ( proxies ) {
        if ( !proxies ) return;

        for ( let proxy of proxies ) {
            proxy = _proxy( proxy );

            if ( proxy ) this.#proxies.push( proxy );
        }
    }

    // XXX
    toString () {}

    // XXX return new Proxy instance
    async startSession ( options = {} ) {
        return this.#rotate( options );
    }

    // XXX type
    async connect ( url ) {
        const proxy = this.#rotate();

        if ( !proxy ) return Promise.reject( "Unable to connect" );

        return proxy.connect( url );
    }

    // XXX use options
    #rotate ( options = {} ) {
        const proxy = this.#proxies.shift();

        this.#proxies.push( proxy );

        return proxy;
    }
};
