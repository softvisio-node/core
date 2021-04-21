module.exports = Super =>
    class extends ( Super || Object ) {
        #rotate = false; // rotate proxies automatically
        #rotateRandom = false; // rotate in random order
        #rotateRequests = 0; // rotate after N request
        #rotateTimeout = 0; // seconds, rotate by timeout

        #cache = {};

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.rotate = options.rotate ?? url.searchParams.get( "rotate" ) ?? this.defaultRotate;

            this.rotateRandom = options.rotateRandom ?? url.searchParams.get( "rotateRandom" );

            this.rotateTimeout = options.rotateTimeout ?? url.searchParams.get( "rotateTimeout" );

            this.rotateRequests = options.rotateRequests ?? url.searchParams.get( "rotateRequests" );
        }

        get url () {
            const url = super.url;

            if ( this.rotate !== this.defaultRotate ) url.searchParams.set( "rotate", this.rotate );

            if ( this.rotateRandom ) url.searchParams.set( "rotateRandom", "true" );

            if ( this.rotateTimeout ) url.searchParams.set( "rotateTimeout", this.rotateTimeout );

            if ( this.rotateRequests ) url.searchParams.set( "rotateRequests", this.rotateRequests );

            return url;
        }

        // rotate
        get defaultRotate () {
            return false;
        }

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

        // rotateRandom
        get rotateRandom () {
            return this.#rotateRandom;
        }

        set rotateRandom ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#rotateRandom === value ) return;

            this.#rotateRandom = value;

            this._updated();
        }

        // rotateTimeout
        get rotateTimeout () {
            return this.#rotateTimeout;
        }

        set rotateTimeout ( value ) {
            value = parseInt( value );
            if ( !value || isNaN( value ) ) value = false;

            // convert to milliseconds
            if ( value ) value = value * 1000;

            // not updated
            if ( this.#rotateTimeout === value ) return;

            this.#rotateTimeout = value;

            this._updated();
        }

        // rotateRequests
        get rotateRequests () {
            return this.#rotateRequests;
        }

        set rotateRequests ( value ) {
            value = parseInt( value );
            if ( !value || isNaN( value ) ) value = false;

            // not updated
            if ( this.#rotateRequests === value ) return;

            this.#rotateRequests = value;

            this._updated();
        }

        _updated () {
            super._updated();

            this.#cache = {};
        }

        async getProxy ( options = {} ) {

            // auto rotation is disabled
            if ( !this.#rotate ) return super._getProxy( options );

            options = this._mergeOptions( options );

            // do not rotate if has session
            if ( options.session ) return this._getUpstream( options, true );

            const key = JSON.stringify( options );

            if ( !this.#cache[key] ) {
                this.#cache[key] = {
                    key,
                    options,
                    "lastRotated": new Date(),
                    "requests": 0,
                    "proxy": null,
                };
            }

            const cache = this.#cache[key];

            // rotate by timeout or by requests number
            if ( this.#rotateTimeout || this.#rotateRequests ) {

                // rotate by timeout
                if ( this.#rotateTimeout && new Date() - cache.lastRotated >= this.#rotateTimeout ) return this.#rotateProxy( cache );

                // rotate by number of requests
                if ( this.#rotateRequests && cache.requests >= this.#rotateRequests ) return this.#rotateProxy( cache );

                // rotation is not required
                // return cached proxy
                if ( cache.proxy ) {
                    cache.requests++;

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

            if ( this.#rotateRandom ) {
                proxy = await this._rotateRandomProxy( cache );
            }
            else {
                proxy = await this._rotateNextProxy( cache );
            }

            cache.proxy = proxy;

            // proxy was rotated
            if ( proxy ) {
                cache.requests = 1;
                cache.lastRotated = new Date();
            }

            return proxy;
        }

        async _rotateNextProxy ( cache ) {
            return this._getUpstream( cache.options );
        }

        async _rotateRandomProxy ( cache ) {
            return this._getUpstream( cache.options );
        }
    };
