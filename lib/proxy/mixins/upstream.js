const Proxy = require( "#lib/proxy" );
const LruCache = require( "lru-cache" );

module.exports = Super =>
    class extends ( Super || Object ) {
        #upstreamUrl;
        #cache = new LruCache( { "max": 10000 } );

        _updated () {
            super._updated();

            this.#cache.reset();
        }

        async connect ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            const proxy = await this.getProxy( { "protocol": url.protocol } );

            if ( !proxy ) return Promise.reject( "Unable to get proxy" );

            return proxy.connect( url );
        }

        async getPlaywrightProxy ( options ) {
            const proxy = await this.getEndpoint( options );

            return proxy.getPlaywrightProxy();
        }

        async getEndpoint ( options ) {
            const proxy = await this.getProxy( options );

            return proxy.getEndpoint();
        }

        async getProxy ( options ) {
            return this._getProxy( options );
        }

        async getNextProxy ( options ) {
            return this._getProxy( options );
        }

        async getRandomProxy ( options ) {
            return this._getProxy( options );
        }

        _mergeOptions ( options = {} ) {
            return this._buildOptions( { ...this._options, ...options } );
        }

        async _getProxy ( options ) {
            return this._getUpstream( this._mergeOptions( options ) );
        }

        async _getUpstream ( mergedOptions ) {
            const key = mergedOptions.session || JSON.stringify( mergedOptions );

            var proxy = this.#cache.get( key );

            if ( proxy ) return proxy;

            proxy = await this._buildProxy( mergedOptions );

            if ( proxy ) this.#cache.set( key, proxy );

            return proxy;
        }

        _buildProxy () {
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
            } );

            return proxy;
        }
    };
