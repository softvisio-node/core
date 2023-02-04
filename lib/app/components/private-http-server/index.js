import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {

    // protected
    async _install () {
        return new Server();
    }

    async _run () {
        const publicHttpServer = this.components.get( "publicHttpServer" );

        if ( publicHttpServer ) {
            const publicHttpServerPort = publicHttpServer.config.port,
                privateHttpServerPort = this.config.port;

            if ( publicHttpServerPort && publicHttpServerPort === privateHttpServerPort ) {
                if ( publicHttpServerPort === 80 ) {
                    this.config.port = 81;
                }
                else {
                    return result( [500, `Public and private HTTP servers ports are the same`] );
                }
            }
        }

        const res = await this.value.listen( {
            "address": this.config.address,
            "port": this.config.port,
            "exclusive": this.config.exclusive,
        } );

        this.config.port = res.data.port;

        if ( res.ok ) {
            console.log( `Private HTTP server listening at ${res.data.address}:${res.data.port}` );
        }
        else {
            console.log( `Private HTTP server unable bind to the ${res.data.address}:${res.data.port}` );
        }

        return res;
    }
}
