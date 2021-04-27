module.exports = class ProxyBucket {
    #id;
    #options;

    #proxy;
    #lastUpdated;
    #requests = 0;

    constructor ( id, options ) {
        this.#id = id;
        this.#options = options;
    }

    get id () {
        return this.#id;
    }

    get options () {
        return this.#options;
    }

    get proxy () {
        return this.#proxy;
    }

    get requests () {
        return this.#requests;
    }

    // public
    getProxy () {
        this.#requests++;

        return this.#proxy;
    }

    setProxy ( proxy ) {
        this.setRotated();

        this.#proxy = proxy;
    }

    // XXX
    requireRotate () {
        const options = this.#options;

        // rotation is disabled
        if ( !options.rotate ) return false;

        // bound to the session
        if ( options.session ) return;

        var rotate = false;

        // rotate by timeout
        if ( options.rotateTimeout && this.#lastUpdated && new Date() - this.#lastUpdated >= options.rotateTimeout ) rotate = true;

        // rotate by number of requests
        if ( !rotate && options.rotateRequests && this.#requests >= options.rotateRequests ) rotate = true;

        // rotate on each request
        if ( !rotate && !options.rotateTimeout && !options.rotateRequests ) rotate = true;

        return rotate;
    }

    setRotated () {
        this.#lastUpdated = new Date();
        this.#requests = 0;
    }
};
