module.exports = Super =>
    class extends ( Super || Object ) {
        #rotate = false; // rotate proxies automatically
        #random = false; // rotate in random order
        #requests = 0; // rotate after N request
        #timeout = 0; // seconds, rotate by timeout

        #cache = {};

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.rotate = options.rotate ?? url.searchParams.get( "rotate" );

            this.random = options.random ?? url.searchParams.get( "random" );

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" );

            this.requests = options.requests ?? url.searchParams.get( "requests" );
        }

        get url () {
            const url = super.url;

            if ( this.rotate ) url.searchParams.set( "rotate", "true" );

            if ( this.random ) url.searchParams.set( "random", "true" );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            if ( this.requests ) url.searchParams.set( "requests", this.requests );

            return url;
        }

        // rotate
        get rotate () {
            return this.#rotate;
        }

        set rotate ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#rotate === value ) return;

            this.#rotate = value;

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

            // convert to milliseconds
            if ( value ) value = value * 1000;

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

            this.#cache = {};
        }

        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            const proxy = await this.tryRotateProxy( { "protocol": url.protocol } );

            if ( !proxy ) return Promise.reject( "Unable to get proxy" );

            return proxy.connect( url );
        }

        async #tryRotateProxy ( options ) {

            // do not rotate automatically
            if ( !this.rotate ) return this.getProxy( options );

            const key = JSON.stringify( options );

            if ( !this.#cache[key] ) {
                this.#cache[key] = {
                    key,
                    options,
                    "lastRotated": new Date(),
                    "numRequests": 0,
                    "proxy": null,
                };
            }

            const cache = this.#cache[key];

            // rotate by timeout or by requests number
            if ( this.#timeout || this.#requests ) {

                // rotate by timeout
                if ( this.#timeout && new Date() - cache.lastRotated >= this.#timeout ) return this.#rotateProxy( cache );

                // rotate by number of requests
                if ( this.#requests && cache.numRequests >= this.#requests ) return this.#rotateProxy( cache );

                // rotation is not required
                // return cached proxy
                if ( cache.proxy ) {
                    cache.numRequests++;

                    return cache.proxy;
                }

                // or try to cache and return proxy
                else {
                    return this.#rotateProxy( cache );
                }
            }

            // rotate on each request
            else {
                return this.#rotateProxy( cache );
            }
        }

        async #rotateProxy ( cache ) {
            var proxy;

            if ( this.random ) {
                proxy = await this._rotateRandomProxy( cache.options );
            }
            else {
                proxy = await this._rotateNextProxy( cache.options );
            }

            cache.proxy = proxy;

            // proxy was rotated
            if ( proxy ) {
                cache.numRequests = 1;
                cache.lastRotated = new Date();
            }

            return proxy;
        }
    };
