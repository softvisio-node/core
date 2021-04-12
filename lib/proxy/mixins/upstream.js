const Proxy = require( "../../proxy" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #session = false; // do not rotate
        #random = false; // rotate in random order
        #requests = 0; // rotate after N request
        #timeout = 0; // rotate by timeout

        #lastRotated = new Date();
        #numRequests = 0;
        #upstream;
        #upstreamUrl;
        #upstreamProtocol;

        $init ( url, options = {} ) {
            if ( typeof url === "string" ) url = new URL( url );

            if ( super.$init ) super.$init( url, options );

            this.session = options.session ?? this._initSession( url.searchParams );

            this.random = options.random ?? url.searchParams.has( "random" );

            this.timeout = options.timeout ?? url.searchParams.get( "timeout" );

            this.requests = options.requests ?? url.searchParams.get( "requests" );
        }

        _initSession ( searchParams ) {
            return searchParams.has( "session" );
        }

        get url () {
            const url = super.url;

            if ( this.session ) {
                if ( this.session === true ) url.searchParams.set( "session", "true" );
                else url.searchParams.set( "session", this.session );
            }

            if ( this.random ) url.searchParams.set( "random", "true" );

            if ( this.timeout ) url.searchParams.set( "timeout", this.timeout );

            if ( this.requests ) url.searchParams.set( "requests", this.requests );

            return url;
        }

        // session
        get session () {
            return this.#session;
        }

        set session ( value ) {
            if ( value === true || value === "true" ) value = true;
            else value = false;

            // not updated
            if ( this.#session === value ) return;

            this.#session = value;

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

        // upstream
        get _upstream () {
            return this.#upstream;
        }

        set _upstream ( value ) {
            this.#upstream = value || null;
        }

        _updated () {
            super._updated();

            this.#upstream = null;
        }

        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            const proxy = await this._autoRotateProxy( { "protocol": url.protocol } );

            if ( !proxy ) return Promise.reject( "Unable to get proxy" );

            return proxy.connect( url );
        }

        async _autoRotateProxy ( options ) {
            this.#numRequests++;

            // do not rotate
            if ( this.session ) {
                return this.getProxy( options );
            }

            // rotate by timeout or by requests number
            else if ( this.#timeout || this.#requests ) {

                // rotate by timeout
                if ( this.#timeout && new Date() - this.#lastRotated >= this.#timeout ) return this.#autoRotateProxy( options );

                // rotate by number of requests
                if ( this.#requests && this.#numRequests > this.#requests ) return this.#autoRotateProxy( options );

                return this.getProxy( options );
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

        async getProxy () {
            if ( !this._upstream ) this._upstream = await this._buildUpstream( this );

            return this._upstream;
        }

        async getNextProxy ( options = {} ) {
            return this._buildUpstream( options );
        }

        async getRandomProxy ( options = {} ) {
            return this._buildUpstream( options );
        }

        async rotateNextProxy ( options = {} ) {
            this._upstream = this._buildUpstream( options );

            return this._upstream;
        }

        async rotateRandomProxy ( options = {} ) {
            this._upstream = this._buildUpstream( options );

            return this._upstream;
        }

        async _buildUpstream ( options = {} ) {
            if ( !this.#upstreamProtocol ) {
                const protocol = [];

                if ( this.isHttp ) protocol.push( "http" );
                if ( this.isSocks ) protocol.push( "socks5" );

                this.#upstreamProtocol = protocol.join( "+" ) + ":";
            }

            if ( !this.#upstreamUrl ) this.#upstreamUrl = new URL( "http://host" );

            const proxy = Proxy.new( this.#upstreamUrl, {
                "protocol": this.#upstreamProtocol,
                "hostname": this.hostname,
                "port": this.port,
                "username": this.username,
                "password": this.password,
            } );

            return proxy;
        }
    };
