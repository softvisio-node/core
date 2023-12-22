export default Super =>
    class extends Super {

        // public
        async API_register ( ctx, serverId, options ) {
            const server = this.app.nginx.addServer( serverId, options );

            const upstream = ctx.remoteAddress.toString();

            await server.addUpstreams( upstream );

            await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );

            await server.deleteUpstreams( upstream );

            if ( !server.hasUpstreams ) await server.delete();

            return result( 200 );
        }
    };
