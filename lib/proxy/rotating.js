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
        const cache = this._getCache( options );

        // auto rotation is disabled
        // or proxy session is defined
        if ( !this.#rotate || cache.options.session ) {
            if ( !cache.proxy ) {
                cache.proxy = await this._buildProxy( cache );
            }

            return cache.proxy;
        }

        var rotate;

        // rotate by timeout
        if ( this.#rotateTimeout && new Date() - cache.autoRotateLastRotated >= this.#rotateTimeout ) rotate = true;

        // rotate by number of requests
        if ( !rotate && this.#rotateRequests && cache.autoRotateRequests >= this.#rotateRequests ) rotate = true;

        // rotate on each request
        if ( !rotate && !this.#rotateTimeout && !this.#rotateRequests ) rotate = true;

        // rotate proxy
        // if rotation is required
        // or no proxy is cached
        if ( rotate || !cache.autoRotateProxy ) {
            let proxy;

            if ( this.#rotateRandom ) {
                proxy = await this._buildRandomProxy( cache, true );
            }
            else {
                proxy = await this._buildNextProxy( cache, true );
            }

            // proxy was rotated
            if ( proxy ) {
                cache.autoRotateProxy = proxy;
                cache.autoRotateLastRotated = new Date();
                cache.autoRotateRequests = 1;
            }
        }
        else {
            cache.autoRotateRequests++;
        }

        return cache.autoRotateProxy;
    }

    async getNextProxy ( options ) {
        const cache = this._getCache( options );

        return await this._buildNextProxy( cache, false );
    }

    async getRandomProxy ( options ) {
        const cache = this._getCache( options );

        return await this._vuildRandomProxy( cache, false );
    }
};
