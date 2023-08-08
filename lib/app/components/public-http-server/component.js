import Component from "#lib/app/component";
import Server from "#lib/http/server";
import Api from "#lib/api";
import { objectOmit } from "#lib/utils";

export default class extends Component {
    #nginxEnabled;
    #nginxAbortController;
    #address;
    #port;

    // protected
    async _install () {
        return new Server();
    }

    async _configureInstance () {
        this.#nginxEnabled = this.app.nginx;

        if ( this.#nginxEnabled ) {
            this.#address = "127.0.0.1";
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

        this.#port = res.data.port;

        if ( res.ok ) {
            console.log( `Public HTTP server listening at: ${this.config.address}:${this.config.port}` );
        }
        else {
            console.log( `Public HTTP server unable bind to the ${this.#address}:${this.#port}` );
        }

        if ( this.#nginxEnabled ) {
            const res = await this.app.nginx.addServer( "_public-http-server", {
                ...this.config.nginx,
                "httpPort": this.config.port,
                "upstreamHttpPort": this.#port,
                "upstreams": this.#address,
            } );
            if ( !res.ok ) return res;
        }

        this.#registerNginx();

        return res;
    }

    async _shutDown () {
        this.#nginxAbortController.aboty();

        return this.instance.stop();
    }

    // private
    async #registerNginx () {
        if ( !this.config.nginx.serverId ) return;

        const api = new Api( this.config.nginx.apiUrl );

        this.#nginxAbortController = new AbortController();

        const signal = this.#nginxAbortController.signal;

        const options = objectOmit( this.config.nginx, ["apiUrl"] );

        while ( true ) {
            const res = await api.call( {
                "methpd": "nginx/register",
                "argumants": [options],
                signal,
            } );

            if ( signal.aborted ) break;

            console.log( `Prublic HTTP server nginx: ${res}` );
        }
    }
}
