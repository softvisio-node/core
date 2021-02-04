const Proxy = require( "../proxy" );
const _proxy = require( "../../proxy" );

module.exports = class ProxyPool extends Proxy {
    #toString;
    #rotate; // auto rotate proxies on each request
    #timeout; // auto rotate using timeout
    #proxies = [];
    #lastRotated;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        super( url, options );

        this.#rotate = options.rotate ?? url.searchParams.get( "rotate" ) ?? true;
        if ( typeof this.#rotate !== "boolean" ) {
            if ( this.#rotate === "true" ) this.#rotate = true;
            else this.#rotate = false;
        }

        this.#timeout = parseInt( options.timeout ?? url.searchParams.get( "timeout" ) ?? 0 );

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

    async startSession ( options = {} ) {
        return this.rotate( options );
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
                    proxy = this.rotate();
                }
                else {
                    proxy = this.#proxies[0];
                }

                this.#lastRotated = new Date();
            }
            else {
                proxy = this.rotate();
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
    rotate ( options = {} ) {
        const proxy = this.#proxies.shift();

        this.#proxies.push( proxy );

        return proxy;
    }
};
