export default Super =>
    class extends Super {
        #connections = new Map();

        // public
        async API_addProxy ( ctx, proxyName, upstreamPort, proxyOptions ) {
            proxyName = "api-" + proxyName;

            const proxy = this.app.nginx.proxies.add( proxyName, upstreamPort, proxyOptions );

            const upstream = ctx.remoteAddress.toString();

            proxy.upstreams.add( upstream );

            ctx.connection.once( "disconnect", this.#onDisconnect.bind( this ) );

            this.#connections.set( ctx.connection, {
                proxy,
                upstream,
            } );

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
