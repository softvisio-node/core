const Proxy = require( "#lib/proxy" );
const LruCache = require( "lru-cache" );

module.exports = class extends Proxy {
    #buckets = new LruCache( { "max": 10000 } );
    #upstreamUrl;

    async getRemoteAddr ( options ) {
        const proxy = await this.getProxy( options );

        if ( !proxy ) return;

        return proxy.getRemoteAddr();
    }

    async getPlaywrightProxy ( options ) {
        const proxy = await this.getProxy( options );

        if ( !proxy ) return;

        return proxy.getPlaywrightProxy();
    }

    async getProxy ( options ) {
        return this.#getProxy( options );
    }

    async getNextProxy ( options ) {
        return this.#getProxy( options );
    }

    async getRandomProxy ( options ) {
        return this.#getProxy( options );
    }

    // connect
    async connect ( url, options = {}, updateHttpRequest ) {
        if ( typeof url === "string" ) url = new URL( url );

        const proxy = await this.getProxy( { ...options, "protocol": url.protocol } );

        if ( !proxy ) return Promise.reject( "Unable to get proxy" );

        return proxy.connect( url, options, updateHttpRequest );
    }

    // protected
    _updated () {
        super._updated();

        this.#buckets.reset();
    }

    _getBucket ( options = {} ) {

        // merge options
        options = this._buildOptions( { ...this._options, ...options } );

        // build bucket key
        const key = options.session || JSON.stringify( options );

        var bucket = this.#buckets.get( key );

        if ( bucket ) return bucket;

        bucket = {
            key,
            options,
            "proxy": null,
            "autoRotateProxy": null,
            "autoRotateLastRotated": new Date(),
            "autoRotateRequests": 0,
        };

        this.#buckets.set( key, bucket );

        return bucket;
    }

    _buildProxy ( bucket ) {
        if ( !this.#upstreamUrl ) {
            const protocol = [];

            if ( this.isHttp ) protocol.push( "http" );
            if ( this.isSocks ) protocol.push( "socks" );

            this.#upstreamUrl = new URL( protocol.join( "+" ) + "://host" );
        }

        const proxy = Proxy.new( this.#upstreamUrl, {
            "hostname": this.hostname,
            "port": this.port,
            "username": this.username,
            "password": this.password,
            "resolve": bucket.options.resolve,
        } );

        return proxy;
    }

    // private
    async #getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) bucket.proxy = await this._buildProxy( bucket );

        return bucket.proxy;
    }
};
