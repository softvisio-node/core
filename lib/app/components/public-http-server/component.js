import NginxApi from "#lib/api/nginx";
import Server from "#lib/http/server";
import { getRandomFreePort } from "#lib/net";

export default Super =>
    class extends Super {
        #port;
        #nginxApi;

        // properties
        get port () {
            return this.#port;
        }

        get nginxApi () {
            return this.#nginxApi;
        }

        // protected
        async _install () {
            return new Server( {
                "setRealIpFrom": this.config.setRealIpFrom,
                "realIpHeader": this.config.realIpHeader,
            } );
        }

        async _afterAppStarted () {
            const hasLocalNginx = this.app.nginx;

            var res, httpServerAddress, httpServerPort;

            if ( hasLocalNginx ) {
                httpServerAddress = `${ this.app.env.unixSocketsDir }/public-http-server.socket`;
            }
            else {
                httpServerAddress = this.config.address;
            }

            // start instance
            res = await this.instance.start( {
                "address": httpServerAddress,
                "port": this.config.port,
                "exclusive": this.config.exclusive,
            } );

            if ( res.ok ) {
                console.log( `Public HTTP server listening at: ${ httpServerAddress }:${ this.config.port }` );

                httpServerPort = res.data.port;
            }
            else {
                console.error( `Public HTTP server unable bind to the ${ httpServerAddress }:${ this.#port }` );

                return res;
            }

            this.#port = httpServerPort;

            // configure local nginx
            if ( hasLocalNginx ) {
                this.#port ||= await getRandomFreePort();

                this.app.nginx.proxies.add( {
                    "public-http-server": {
                        "upstreamPort": httpServerPort,
                        "serverNames": this.config.nginx.serverNames,
                        "servers": [
                            {
                                ...this.config.nginx.server,
                                "port": this.#port,
                                "type": "http",
                            },
                            {
                                ...this.config.nginx.server,
                                "port": 443,
                                "type": "http",
                                "ssl": true,
                            },
                        ],
                        "upstreams": this.instance.nginxAddress,
                    },
                } );
            }

            // configure upstream nginx
            if ( this.config.nginx.proxyId ) {
                this.#nginxApi = new NginxApi( {
                    "apiUrl": this.config.nginx.apiUrl,
                    "proxyId": this.config.nginx.proxyId,
                    "proxyOptions": {
                        "upstreamPort": this.#port,
                        "serverNames": this.config.nginx.serverNames,
                        "servers": [
                            {
                                ...this.config.nginx.server,
                                "port": this.config.nginx.port,
                                "type": "http",
                            },
                            {
                                ...this.config.nginx.server,
                                "port": 443,
                                "type": "http",
                                "ssl": true,
                            },
                        ],
                    },
                } );

                res = await this.#nginxApi.start();

                if ( !res.ok ) {
                    console.error( `Public HTTP server unable to register on nginx` );

                    return res;
                }
            }

            return result( 200 );
        }

        async _destroy () {
            return this.instance.stop();
        }
    };
