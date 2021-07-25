import ProxyClient from "#lib/proxy/proxy";
import CacheLRU from "@softvisio/utils/cache-lru";
import Bucket from "./bucket.js";

export default class extends ProxyClient {
    #buckets = new CacheLRU( { "max": 10000 } );
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
        const prefix = options.prefix ?? "";

        // merge options
        options = this._buildOptions( { ...this._options, ...options } );

        // build bucket key
        const id =
            prefix +
            ( options.session ||
                JSON.stringify( Object.keys( options )
                    .sort()
                    .reduce( ( result, key ) => {
                        result[key] = options[key];
                        return result;
                    }, {} ) ) );

        var bucket = this.#buckets.get( id );

        if ( bucket ) return bucket;

        bucket = new Bucket( id, options );

        this.#buckets.set( id, bucket );

        return bucket;
    }

    _buildProxy ( bucket ) {
        if ( !this.#upstreamUrl ) {
            const protocol = [];

            if ( this.isHttp ) protocol.push( "http" );
            if ( this.isSocks ) protocol.push( "socks" );

            this.#upstreamUrl = new URL( protocol.join( "+" ) + "://host" );
        }

        const proxy = ProxyClient.new( this.#upstreamUrl, {
            "hostname": this.hostname,
            "port": this.port,
            "username": this.username,
            "password": this.password,
            "resolve": bucket.options.resolve,
        } );

        return proxy;
    }
}
