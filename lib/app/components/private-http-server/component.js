import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {
    #nginxEnabled;
    #nginxPort;

    // protected
    async _install () {
        return new Server();
    }

    _configureInstance () {
        const publicHttpServer = this.components.get( "publicHttpServer" );

        if ( publicHttpServer ) {
            const publicHttpServerPort = publicHttpServer.config.port;

            if ( publicHttpServerPort && publicHttpServerPort === this.config.port ) {
                if ( publicHttpServerPort === 80 ) {
                    this.config.port = 81;
                }
                else {
                    return result( [500, `Public and private HTTP servers ports are the same`] );
                }
            }
        }

        this.#nginxEnabled = this.app.nginx;

        if ( this.#nginxEnabled ) {
            this.#nginxPort = this.config.port;

            this.config.address = "127.0.0.1";
            this.config.port = null;
        }

        return result( 200 );
    }

    async _afterAppStarted () {
        const res = await this.instance.start( {
            "address": this.config.address,
            "port": this.config.port,
            "exclusive": this.config.exclusive,
        } );

        const listen = res.data;

        if ( res.ok ) {
            console.log( `Private HTTP server listening at: ${listen.address}:${listen.port}` );
        }
        else {
            console.log( `Private HTTP server unable bind to the ${listen.address}:${listen.port}` );
        }

        if ( this.#nginxEnabled ) {
            const res = await this.app.nginx.addServer( "private-http-server", {
                "serverNames": "*",
                "httpPort": this.#nginxPort,
                "upstreamHttpPort": listen.port,
                "upstreams": listen.address,
            } );
            if ( !res.ok ) return res;
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
