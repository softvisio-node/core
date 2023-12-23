export default Super =>
    class extends Super {

        // public
        async API_register ( ctx, serverId, options ) {
            const server = this.app.nginx.addServer( `_api-${serverId}_${options.type}_${options.port || "default"}`, options );

            const upstream = ctx.remoteAddress.toString();

            try {
                const res = await server.addUpstreams( upstream );

                if ( !res.ok ) throw res;

                await new Promise( resolve => ctx.connection.once( "disconnect", resolve ) );
            }
            catch ( e ) {}

            await server.deleteUpstreams( upstream );

            if ( !server.hasUpstreams ) await server.delete();

            return result( 200 );
        }
    };
