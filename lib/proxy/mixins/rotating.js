module.exports = Super =>
    class extends ( Super || Object ) {
        #persistent; // do not rotate
        #requests; // rotate after N request
        #timeout; // rotate by timeout
        #random; // rotate in random order

        #lastRotated = new Date();
        #numRequests = 0;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.persistent = options.persistent ?? url.searchParams.get( "persistent" ) ?? false;

            this.random = options.random ?? url.searchParams.get( "random" ) ?? false;

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" ) ?? 0;

            this.requests = options.requests ?? url.searchParams.get( "requests" ) ?? 0;
        }

        get url () {
            const url = super.url;

            if ( this.persistent ) url.searchParams.set( "persistent", this.persistent );

            if ( this.random ) url.searchParams.set( "random", this.random );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            if ( this.requests ) url.searchParams.set( "requests", this.requests );

            return url;
        }

        get persistent () {
            return this.#persistent;
        }

        set persistent ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#persistent === ( value || false ) ) return;

            this.#persistent = value;

            this._updated();
        }

        get random () {
            return this.#random;
        }

        set random ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#random === ( value || false ) ) return;

            this.#random = value;

            this._updated();
        }

        get timeout () {
            return this.#timeout;
        }

        set timeout ( value ) {
            value = parseInt( value || 0 );

            // not updated
            if ( this.#timeout === ( value || 0 ) ) return;

            this.#timeout = value;

            this._updated();
        }

        get requests () {
            return this.#requests;
        }

        set requests ( value ) {
            value = parseInt( value || 0 );

            // not updated
            if ( this.#requests === ( value || 0 ) ) return;

            this.#requests = value;

            this._updated();
        }

        async _autoRotateProxy ( options ) {
            this.#numRequests++;

            // do not rotate
            if ( this.persistent ) {
                return await this.getProxy( options );
            }

            // rotate by timeout or by requests number
            else if ( this.#timeout || this.#requests ) {

                // rotate by timeout
                if ( this.#timeout && new Date() - this.#lastRotated > this.#timeout ) return this.#autoRotateProxy( options );

                // rotate by number of requests
                if ( this.#requests && this.#numRequests >= this.#requests ) return this.#autoRotateProxy( options );
            }

            // rotate on each request
            else {
                return this.#autoRotateProxy( options );
            }
        }

        async #autoRotateProxy ( options ) {
            var proxy;

            if ( this.random ) {
                proxy = await this.rotateRandomProxy( options );
            }
            else {
                proxy = await this.rotateNextProxy( options );
            }

            // proxy was rotated
            if ( proxy ) {
                this.#numRequests = 1;
                this.#lastRotated = new Date();
            }

            return proxy;
        }
    };
