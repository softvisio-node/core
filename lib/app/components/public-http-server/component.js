import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {

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

        if ( this.app.nginx && ( this.config.nginx?.serverNames || this.config.nginx?.streamPortss ) ) {
            const res = this.app.ngin.addServer( "public-http-server", this.config.nginx );

            if ( !res.ok ) return res;

            const server = this.app.nginx.getServer( "public-http-server" );

            await server.addUpstream( "127.0.0.1" );
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
