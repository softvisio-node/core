const Proxy = require( "../proxy" );
const _proxy = require( "../../proxy" );

module.exports = class ProxyPool extends Proxy {
    #rotate; // auto rotate proxies on each request
    #timeout; // auto rotate using timeout
    #toString;
    #proxies = [];
    #lastRotated;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        this.rotate = options.rotate ?? url.searchParams.get( "rotate" ) ?? true;

        this.timeout = options.timeout ?? url.searchParams.get( "timeout" ) ?? 0;

        this.addProxies( url.searchParams.getAll( "proxy" ) );

        if ( options.proxies ) this.addProxies( options.proxies );
    }

    // FEATURES
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get isStatic () {
        return false;
    }

    // PROPS
    get rotate () {
        return this.#rotate;
    }

    set rotate ( value ) {
        if ( value === true || value === "true" || value === 1 ) this.#rotate = true;
        else this.#rotate = false;
    }

    get timeout () {
        return this.#timeout;
    }

    set timeout ( value ) {
        this.#timeout = parseInt( value );
    }

    // METHODS
    setProxies ( proxies ) {
        this.#proxies = [];

        this.addProxies( proxies );
    }

    addProxies ( proxies ) {
        this.#toString = null;

        if ( !proxies ) return;

        for ( let proxy of proxies ) {
            proxy = _proxy( proxy );

            if ( proxy ) this.#proxies.push( proxy );
        }
    }

    toString () {
        if ( !this.#toString ) {
            const url = this._url;

            url.searchParams.set( "rotate", this.#rotate );

            url.searchParams.set( "timeout", this.#timeout );

            for ( const proxy of this.#proxies ) {
                url.searchParams.append( "proxy", proxy.toString() );
            }

            this.#toString = url.toString();
        }

        return this.#toString;
    }

    async getRemoteAddr () {
        return this.#proxies[0].getRemoteAddr();
    }

    async startSession ( options = {} ) {
        return this.next( options );
    }

    // XXX type
    async connect ( url ) {
        var proxy;

        // auto rotate
        if ( this.#rotate ) {

            // rotate using timeout
            if ( this.#timeout ) {
                if ( !this.#lastRotated ) {
                    proxy = this.#proxies[0];
                }
                else if ( new Date().getTime() - this.#lastRotated >= this.#timeout ) {
                    proxy = this.next();
                }
                else {
                    proxy = this.#proxies[0];
                }

                this.#lastRotated = new Date();
            }
            else {
                proxy = this.next();
            }
        }

        // do not rotate
        else {
            proxy = this.#proxies[0];
        }

        if ( !proxy ) return Promise.reject( "Unable to connect" );

        return proxy.connect( url );
    }

    // XXX use options
    next ( options = {} ) {
        const proxy = this.#proxies.shift();

        this.#proxies.push( proxy );

        return proxy;
    }
};
