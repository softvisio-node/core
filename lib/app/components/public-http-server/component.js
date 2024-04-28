import Server from "#lib/http/server";
import Api from "#lib/api";

export default Super =>
    class extends Super {
        #nginxEnabled;
        #nginxAbortController;
        #address;
        #port;

        // protected
        async _install () {
            return new Server( {
                "setRealIpFrom": this.config.setRealIpFrom,
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

            this.#registerNginx();

            return res;
        }

        async _shutDown () {
            this.#nginxAbortController?.abort();

            return this.instance.stop();
        }

        // private
        async #registerNginx () {
            if ( !this.config.nginxProxyName ) return;

            const api = new Api( this.config.nginxApiUrl );

            this.#nginxAbortController = new AbortController();

            const signal = this.#nginxAbortController.signal;

            const options = {
                "servers": [
                    {
                        ...this.config.nginx,
                        "port": 80,
                    },
                    {
                        ...this.config.nginx,
                        "port": 443,
                    },
                ],
            };

            while ( true ) {
                const res = await api.call( {
                    "methpd": "nginx/register",
                    "argumants": [ this.config.nginxProxyName, this.config.port, options ],
                    signal,
                } );

                if ( signal.aborted ) break;

                console.log( `Prublic HTTP server nginx: ${ res }` );
            }
        }
    };
