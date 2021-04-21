const Proxy = require( "#lib/proxy" );
const LruCache = require( "lru-cache" );

module.exports = Super =>
    class extends ( Super || Object ) {
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

        async getProxy ( options ) {
            return this._getUpstream( options );
        }

        async _getUpstream ( options = {} ) {
            options = this._buildOptions( { ...this._options, ...options } );

            var key;

            if ( options.session ) key = options.session;
            else key = JSON.stringify( options );

            var proxy = this.#cache.get( options.session );

            if ( proxy ) return proxy;

            proxy = await this._buildProxy( options );

            if ( proxy ) this.#cache.set( key, proxy );

            return proxy;
        }

        // XXX protocol
        _buildProxy ( options = {} ) {
            const proxy = Proxy.new( new URL( "proxy:" ), {
                "protocol": "http+socks:",
                "hostname": this.hostname,
                "port": this.port,
                "username": this.username,
                "password": this.password,
            } );

            return proxy;
        }
    };
