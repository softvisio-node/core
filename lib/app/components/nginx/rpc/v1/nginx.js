export default Super =>
    class extends Super {
        #connections = new Map();

        // public
        async API_addProxies ( ctx, proxies ) {
            const connection = ctx.connection;

            if ( !this.#connections.has( connection ) ) {
                const upstream = ctx.remoteAddress.toString(),
                    disconnectListener = this.#onDisconnect.bind( this );

                const addedProxies = new Set();

                for ( const [ proxyId, proxyOptions ] of Object.entries( proxies ) ) {
                    const id = "api-" + proxyId;

                    this.app.nginx.proxies.add( {
                        [ id ]: proxyOptions,
                    } );

                    const proxy = this.app.nginx.proxies.get( id );

                    if ( !proxy ) continue;

                    addedProxies.add( proxy );

                    proxy.upstreams.add( upstream );
                }

                if ( addedProxies.size ) {
                    this.#connections.set( connection, {
                        "proxies": addedProxies,
                        upstream,
                        disconnectListener,
                    } );

                    connection.once( "disconnect", disconnectListener );
                }
            }

            return result( 200 );
        }

        async API_deleteUpstream ( ctx ) {
            const connection = ctx.connection;

            this.#onDisconnect( connection );

            return result( 200 );
        }

        // private
        #onDisconnect ( connection ) {
            if ( !this.#connections.has( connection ) ) return;

            const { proxies, upstream, disconnectListener } = this.#connections.get( connection );

            this.#connections.delete( connection );

            connection.off( "disconnect", disconnectListener );

            for ( const proxy of proxies ) {
                proxy.upstreams.delete( upstream );

                if ( !proxy.upstreams.hasUpstreams ) proxy.delete();
            }
        }
    };
