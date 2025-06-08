export default Super =>
    class extends Super {
        #apps = {};
        #connections = new Map();

        // public
        async [ "API_get-certificates" ] ( ctx, serverNames ) {
            if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

            const certificates = {};

            await Promise.all( serverNames.map( serverName => {
                if ( this.app.acme?.canGetCertificate( serverName ) ) {
                    return this.app.acme
                        .getCertificate( serverName, {
                            "pem": true,
                        } )
                        .then( res => {
                            if ( res.ok ) {
                                certificates[ serverName ] = {
                                    "certificate": res.data.certificate,
                                    "privateKey": res.data.privateKey,
                                    "fingerprint": res.data.fingerprint,
                                    "expires": res.data.expires,
                                };
                            }
                            else {
                                certificates[ serverName ] = null;
                            }
                        } );
                }
                else {
                    certificates[ serverName ] = null;
                }
            } ) );

            return result( 200, certificates );
        }

        async [ "API_update-proxies" ] ( ctx, appName, serviceName, updateId, proxies ) {
            var appId = appName + "_" + serviceName;

            const connection = ctx.connection;

            // register new connection
            if ( !this.#connections.has( connection ) ) {
                this.#connections.set( connection, appId );

                connection.once( "disconnect", this.#onDisconnect.bind( this ) );
            }
            else {
                appId = this.#connections.get( connection );
            }

            var app = this.#apps[ appId ];

            // register new app
            if ( !app ) {
                app = this.#apps[ appId ] = {
                    appId,
                    "updateId": 0,
                    "connections": new Set(),
                    "proxies": new Set(),
                };
            }

            // register app connection
            app.connections.add( connection );

            // update proxies
            if ( app.updateId < updateId ) {
                app.updateId = updateId;

                // delete proxies
                for ( const proxy of app.proxies ) {
                    app.proxies.delete( proxy );

                    proxy.delete();
                }

                // create proxies
                for ( const [ proxyId, proxyOptions ] of Object.entries( proxies || {} ) ) {
                    const id = "api_" + appId + "_" + proxyId;

                    this.app.nginx.proxies.add( {
                        [ id ]: proxyOptions,
                    } );

                    const proxy = this.app.nginx.proxies.get( id );

                    app.proxies.add( proxy );
                }
            }

            // set upstreams
            if ( app.proxies.size ) {
                const upstreams = [ ...app.connections ].map( connection => connection.remoteAddress );

                for ( const proxy of app.proxies ) {
                    proxy.upstreams.set( upstreams );
                }
            }

            return result( 200 );
        }

        // private
        #onDisconnect ( connection ) {
            const appId = this.#connections.get( connection ),
                app = this.#apps[ appId ],
                upstream = connection.remoteAddress;

            // delete connection
            this.#connections.delete( connection );
            app.connections.delete( connection );

            for ( const proxy of app.proxies ) {
                proxy.upstreams.delete( upstream );

                // delete proxies without upstreams
                if ( !proxy.upstreams.hasUpstreams ) {
                    app.proxies.delete( proxy );

                    proxy.delete();
                }
            }

            // delete app without connections
            if ( !app.connections.size ) {
                delete this.#apps[ appId ];
            }
        }
    };
