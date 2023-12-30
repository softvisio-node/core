export default Super =>
    class extends Super {

        // public
        async API_addProxy ( ctx, name, port, options ) {
            const proxy = this.app.nginx.addProxy( "_api-" + name, port, options );

            const upstream = ctx.remoteAddress.toString();

            proxy.addUpstreams( upstream );

            // wait for connection close
            await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );

            proxy.deleteUpstreams( upstream );

            if ( !proxy.hasUpstreams ) proxy.delete();

            return result( 200 );
        }
    };
