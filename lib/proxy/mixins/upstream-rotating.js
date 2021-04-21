const LruCache = require( "lru-cache" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #persistent = false; // do not rotate
        #random = false; // rotate in random order
        #requests = 0; // rotate after N request
        #timeout = 0; // rotate by timeout

        #lastRotated = new Date();
        #numRequests = 0;
        #upstream;

        #cache = new LruCache( { "max": 10000 } );

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.persistent = options.persistent ?? url.searchParams.get( "persistent" );

            this.random = options.random ?? url.searchParams.get( "random" );

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" );

            this.requests = options.requests ?? url.searchParams.get( "requests" );
        }

        get url () {
            const url = super.url;

            if ( this.persistent ) {
                if ( this.persistent === true ) url.searchParams.set( "persistent", "true" );
                else url.searchParams.set( "persistent", this.persistent );
            }

            if ( this.random ) url.searchParams.set( "random", "true" );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            if ( this.requests ) url.searchParams.set( "requests", this.requests );

            return url;
        }

        // persistent
        get persistent () {
            return this.#persistent;
        }

        set persistent ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#persistent === value ) return;

            this.#persistent = value;

            this._updated();
        }

        // random
        get random () {
            return this.#random;
        }

        set random ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#random === value ) return;

            this.#random = value;

            this._updated();
        }

        // timeout
        get timeout () {
            return this.#timeout;
        }

        set timeout ( value ) {
            value = parseInt( value );
            if ( !value || isNaN( value ) ) value = false;

            // not updated
            if ( this.#timeout === value ) return;

            this.#timeout = value;

            this._updated();
        }

        // requests
        get requests () {
            return this.#requests;
        }

        set requests ( value ) {
            value = parseInt( value );
            if ( !value || isNaN( value ) ) value = false;

            // not updated
            if ( this.#requests === value ) return;

            this.#requests = value;

            this._updated();
        }

        _updated () {
            super._updated();

            this.#upstream = null;
        }

        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            const proxy = await this.#autoRotateProxy( { "protocol": url.protocol } );

            if ( !proxy ) return Promise.reject( "Unable to get proxy" );

            return proxy.connect( url );
        }

        async #autoRotateProxy ( options ) {
            this.#numRequests++;

            // do not rotate
            if ( this.persistent ) {
                return this.#getUpstream( options );
            }

            // rotate by timeout or by requests number
            else if ( this.#timeout || this.#requests ) {

                // rotate by timeout
                if ( this.#timeout && new Date() - this.#lastRotated >= this.#timeout ) return this.#rotateProxy( options );

                // rotate by number of requests
                if ( this.#requests && this.#numRequests > this.#requests ) return this.#rotateProxy( options );

                return this.#getUpstream( options );
            }

            // rotate on each request
            else {
                return this.#rotateProxy( options );
            }
        }

        // XXX if not require rotate
        // call getProxy() or rotate?
        // - if persistent - call
        async #getUpstream ( options ) {
            if ( this.#upstream ) return this.#upstream;

            return this.#autoRotateProxy( options );
        }

        async #rotateProxy ( options ) {
            var proxy;

            if ( this.random ) {
                proxy = await this.rotateRandomProxy( options );
            }
            else {
                proxy = await this.rotateNextProxy( options );
            }

            // proxy was rotated
            if ( proxy ) {
                this.#upstream = proxy;

                this.#numRequests = 1;
                this.#lastRotated = new Date();
            }

            return proxy;
        }

        #buildOptions ( options = {} ) {
            options = this._buildOptions( ...this._options, ...options );

            var key;

            if ( options.session ) key = options.session;
            else key = JSON.stringify( options );

            var proxy = this.#cache.get( options.session );

            if ( proxy ) return proxy;

            proxy = this._buildProxy( options );

            if ( proxy ) this.#cache.set( key, proxy );

            return proxy;
        }
    };
