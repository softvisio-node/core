const Upstream = require( "./upstream" );

module.exports = class extends Upstream {
    #rotate = false; // rotate proxies automatically
    #rotateRandom = false; // rotate in random order
    #rotateRequests = 0; // rotate after N request
    #rotateTimeout = 0; // seconds, rotate by timeout

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

    // upstream
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        return this._getProxy( bucket );
    }

    async getNextProxy ( options ) {
        const bucket = this._getBucket( options );

        return this._getNextProxy( bucket );
    }

    async getRandomProxy ( options ) {
        const bucket = this._getBucket( options );

        return this._getRandomProxy( bucket );
    }

    // protected
    async _getProxy ( bucket ) {

        // auto rotation is disabled or proxy session is defined
        if ( !this.#rotate || bucket.options.session ) {

            // proxy is not cached
            if ( !bucket.proxy ) {

                // if session is defined - get random proxy
                if ( bucket.options.session ) bucket.proxy = await this._buildRandomProxy( bucket, true );

                // if session is not defined - get first proxy
                else bucket.proxy = await this._buildProxy( bucket );
            }

            return bucket.proxy;
        }

        var rotate;

        // rotate by timeout
        if ( this.#rotateTimeout && new Date() - bucket.autoRotateLastRotated >= this.#rotateTimeout ) rotate = true;

        // rotate by number of requests
        if ( !rotate && this.#rotateRequests && bucket.autoRotateRequests >= this.#rotateRequests ) rotate = true;

        // rotate on each request
        if ( !rotate && !this.#rotateTimeout && !this.#rotateRequests ) rotate = true;

        // rotate proxy
        // if rotation is required
        // or no proxy is cached
        if ( rotate || !bucket.autoRotateProxy ) {
            let proxy;

            if ( this.#rotateRandom ) {
                proxy = await this._buildRandomProxy( bucket, true );
            }
            else {
                proxy = await this._buildNextProxy( bucket, true );
            }

            bucket.autoRotateProxy = proxy;

            // proxy was rotated
            if ( proxy ) {
                bucket.autoRotateLastRotated = new Date();
                bucket.autoRotateRequests = 1;
            }
        }

        // use currently selected proxy, increase number of requests
        else {
            bucket.autoRotateRequests++;
        }

        return bucket.autoRotateProxy;
    }

    async _getNextProxy ( bucket ) {
        const proxy = await this._buildNextProxy( bucket, false );

        return proxy;
    }

    async _getRandomProxy ( bucket ) {
        const proxy = await this._buildRandomProxy( bucket, false );

        return proxy;
    }
};
