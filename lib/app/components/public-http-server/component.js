import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {
    #nginxEnabled;

    // protected
    async _configure () {
        this.#nginxEnabled = this.components.get( "nginx" ) && ( this.config.nginx?.serverNames || this.config.nginx?.streamPortss );

        if ( this.#nginxEnabled ) {
            this.config.address = "127.0.0.1";
            this.config.port = null;
        }

        return result( 200 );
    }

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

        if ( this.#nginxEnabled ) {
            let res = await this.app.nginx.addServer( "public-http-server", {
                ...this.config.nginx,
                "httpPort": this.config.port,
            } );
            if ( !res.ok ) return res;

            const server = res.data;

            res = await server.addUpstreams( this.config.address );
            if ( !res.ok ) return res;
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
