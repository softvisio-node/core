import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {
    #nginxEnabled;
    #address;
    #port;

    // protected
    async _install () {
        return new Server();
    }

    async _configureInstance () {
        this.#nginxEnabled = this.app.nginx && this.config.nginx?.serverNames;

        if ( this.#nginxEnabled ) {
            this.#address = "127.0.0.1";
            this.#port = null;

            this.config.address = "0.0.0.0";
            this.config.port = this.app.nginx.config.httpPort;
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

        this.#port = res.data.port;

        if ( res.ok ) {
            console.log( `Public HTTP server listening at: ${this.config.address}:${this.config.port}` );
        }
        else {
            console.log( `Public HTTP server unable bind to the ${this.#address}:${this.#port}` );
        }

        if ( this.#nginxEnabled ) {
            const res = await this.app.nginx.addServer( "public-http-server", {
                ...this.config.nginx,
                "upstreamHttpPort": this.#port,
                "upstreams": this.#address,
            } );
            if ( !res.ok ) return res;
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
