import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {

    // protected
    configure () {
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

        return result( 200 );
    }

    async _install () {
        return new Server();
    }

    async _postStart () {
        const res = await this.instance.start( {
            "address": this.config.address,
            "port": this.config.port,
            "exclusive": this.config.exclusive,
        } );

        if ( res.ok ) {
            console.log( `Private HTTP server listening at: ${res.data.address}:${res.data.port}` );
        }
        else {
            console.log( `Private HTTP server unable bind to the ${res.data.address}:${res.data.port}` );
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
