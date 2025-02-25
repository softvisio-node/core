export default Super =>
    class extends Super {
        #connections = new Map();

        // public
        async API_addProxy ( ctx, proxyId, proxyOptions ) {
            const connection = ctx.connection;

            if ( !this.#connections.has( connection ) ) {
                const upstream = ctx.remoteAddress.toString(),
                    disconnectListener = this.#onDisconnect.bind( this );

                proxyId = "api-" + proxyId;

                this.app.nginx.proxies.add( {
                    [ proxyId ]: proxyOptions,
                } );

                const proxy = this.app.nginx.proxies.get( proxyId );

                proxy.upstreams.add( upstream );

                this.#connections.set( connection, {
                    proxy,
                    upstream,
                    disconnectListener,
                } );

                connection.once( "disconnect", disconnectListener );
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

            const { proxy, upstream, disconnectListener } = this.#connections.get( connection );

            this.#connections.delete( connection );

            connection.off( "disconnect", disconnectListener );

            proxy.upstreams.delete( upstream );

            if ( !proxy.upstreams.hasUpstreams ) proxy.delete();
        }
    };
