import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {
    #nginxEnabled;
    #tengineEnabled;

    // protected
    async _install () {
        return new Server();
    }

    async _configureInstance () {
        this.#nginxEnabled = this.app.nginx && ( this.config.nginx?.serverNames || this.config.nginx?.streamPortss );
        this.#tengineEnabled = this.app.tengine && ( this.config.nginx?.serverNames || this.config.nginx?.streamPortss );

        if ( this.#nginxEnabled ) {
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
            console.log( `Public HTTP server listening at: ${res.data.address}:${res.data.port}` );
        }
        else {
            console.log( `Public HTTP server unable bind to the ${res.data.address}:${res.data.port}` );
        }

        if ( this.#nginxEnabled ) {
            const res = await this.app.nginx.addServer( "public-http-server", {
                ...this.config.nginx,
                "upstreamHttpPort": listen.port,
                "upstreams": listen.address,
            } );
            if ( !res.ok ) return res;
        }
        else if ( this.#tengineEnabled ) {
            const res = await this.app.tengine.addServer( "public-http-server", {
                ...this.config.nginx,
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
