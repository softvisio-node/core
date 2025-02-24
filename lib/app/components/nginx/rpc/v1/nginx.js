export default Super =>
    class extends Super {

        // public
        async API_addProxy ( ctx, name, upstreamPort, options ) {
            const proxy = this.app.nginx.proxies.add( "api-" + name, upstreamPort, options );

            const upstream = ctx.remoteAddress.toString();

            proxy.upstreams.add( upstream );

            // wait for connection close
            await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );

            proxy.upstreams.delete( upstream );

            if ( !proxy.upstreams.hasUpstreams ) proxy.delete();

            return result( 200 );
        }
    };
