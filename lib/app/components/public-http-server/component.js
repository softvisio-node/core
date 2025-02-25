import NginxApi from "#lib/api/nginx";
import Server from "#lib/http/server";

export default Super =>
    class extends Super {
        #nginxEnabled;
        #address;
        #port;
        #nginxApi;

        // properties
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

        async _configureInstance () {
            this.#nginxEnabled = this.app.nginx;

            if ( this.#nginxEnabled ) {
                this.#address = `${ this.app.env.unixSocketsDir }/public-http-server.socket`;
                this.#port = null;

                this.config.address = "0.0.0.0";
            }
            else {
                this.#address = this.config.address;
                this.#port = this.config.port;
            }

            return result( 200 );
        }

        async _afterAppStarted () {
            const res = await this.instance.start( {
                "address": this.#address,
                "port": this.#port,
                "exclusive": this.config.exclusive,
            } );

            if ( res.ok ) {
                console.log( `Public HTTP server listening at: ${ this.config.address }:${ this.config.port }` );
            }
            else {
                console.log( `Public HTTP server unable bind to the ${ this.#address }:${ this.#port }` );
            }

            if ( this.config.nginx.proxyName ) {
                this.#nginxApi = new NginxApi( this.config.nginx.proxyName, this.config.port, {
                    "apiUrl": this.config.nginx.apiUrl,
                    "serverNames": this.config.nginx.serverNames,
                    "servers": {
                        "80": this.config.nginx,
                        "443": this.config.nginx,
                    },
                } );
            }

            return res;
        }

        async _destroy () {
            return this.instance.stop();
        }
    };
