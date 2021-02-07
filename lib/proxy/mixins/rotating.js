module.exports = Super =>
    class extends ( Super || Object ) {
        #persistent; // do not rotate
        #random; // rotate in random order
        #timeout; // rotate by timeout
        #requests; // rotate after N request

        #lastRotated;
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

        _rotateCurrentProxy () {
            if ( this.persistent ) return false;

            if ( !this.#lastRotated ) this.#lastRotated = new Date();

            var rotateCurrentProxy;

            // rotate by number of requests
            if ( this.request ) {
                this.#numRequests++;

                if ( this.#numRequests >= this.request ) rotateCurrentProxy = true;
                else rotateCurrentProxy = false;
            }

            // rotate by timeout
            if ( !rotateCurrentProxy && this.timeout ) {
                if ( new Date().getTime() - this.#lastRotated >= this.timeout ) rotateCurrentProxy = true;
                else rotateCurrentProxy = false;
            }

            rotateCurrentProxy ??= true;

            // drop counters
            if ( rotateCurrentProxy ) {
                this.#numRequests = 0;
                this.#lastRotated = new Date();
            }

            return rotateCurrentProxy;
        }
    };
