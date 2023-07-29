import Component from "#lib/app/component";
import Server from "#lib/http/server";
import Api from "#lib/api";

export default class extends Component {
    #nginx;
    #abortController = new AbortController();

    // protected
    async _install () {
        return new Server();
    }

    async _afterAppStarted () {
        const res = await this.instance.start( {
            "address": this.config.address,
            "port": this.config.port,
            "exclusive": this.config.exclusive,
        } );

        if ( res.ok ) {
            console.log( `Public HTTP server listening at: ${res.data.address}:${res.data.port}` );
        }
        else {
            console.log( `Public HTTP server unable bind to the ${res.data.address}:${res.data.port}` );
        }

        if ( this.config.nginx?.apiUrl && this.config.nginx?.config?.serverName ) {
            this.#nginx = new Api( this.config.nginx?.apiUrl );

            process.stdout.write( `Connecting to nginx ... ` );

            await this.#nginx.waitConnect;

            console.log( "connected" );

            this.#addNginxUpstream();
        }

        return res;
    }

    async _shutDown () {
        this.#abortController.abort();

        return this.instance.stop();
    }

    // private
    async #addNginxUpstream () {
        while ( true ) {
            const res = await this.#nginx.call( {
                "method": "add-upstream",
                "arguments": [this.config.nginx.config],
                "signal": this.#abortController.signal,
            } );

            if ( !res.ok ) console.log( `Unable to add nginx upstream: ${res}` );

            if ( this.isShuttingDown ) {
                break;
            }
        }
    }
}
