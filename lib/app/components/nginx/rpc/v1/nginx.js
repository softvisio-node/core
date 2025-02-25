export default Super =>
    class extends Super {
        #connections = new Map();

        // public
        async API_addProxy ( ctx, name, upstreamPort, options ) {
            name = "api-" + name;

            const proxy = this.app.nginx.proxies.add( name, upstreamPort, options );

            const upstream = ctx.remoteAddress.toString();

            proxy.upstreams.add( upstream );

            ctx.connection.once( "disconnect", this.#onDisconnect.bind( this ) );

            return result( 200 );
        }

        // private
        #onDisconnect ( connection ) {
            const { proxy, upstream } = this.#connections.get( connection );

            this.#connections.delete( connection );

            proxy.upstreams.delete( upstream );

            if ( !proxy.upstreams.hasUpstreams ) proxy.delete();
        }
    };
