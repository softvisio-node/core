export default Super =>
    class extends Super {

        // public
        async API_addProxy ( ctx, name, upstreamPort, options ) {
            const proxy = this.app.nginx.addProxy( "api-" + name, upstreamPort, options );

            const upstream = ctx.remoteAddress.toString();

            proxy.addUpstreams( upstream );

            // wait for connection close
            await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );

            proxy.deleteUpstreams( upstream );

            if ( !proxy.hasUpstreams ) proxy.delete();

            return result( 200 );
        }
    };
