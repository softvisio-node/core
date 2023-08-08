export default Super =>
    class extends Super {

        // public
        async API_register ( ctx, serverId, options ) {
            if ( !options.serverNames && !options.streamPorts ) return result( [400, `Server names or stream ports are required`] );

            const upstream = ctx.remoteAddress.toString();

            var server = this.app.nginx.getServer( serverId );

            if ( server ) {
                server.addUpstreams( upstream );
            }
            else {
                server = await this.app.nginx.addServer( serverId, {
                    ...options,
                    "upstreams": [upstream],
                } );

                if ( !server.ok ) return server;

                server = server.data;
            }

            await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );

            if ( server.upstreamsCount === 1 ) {
                server.delete();
            }
            else {
                server.deleteUpstreams( upstream );
            }

            return result( 200 );
        }
    };
