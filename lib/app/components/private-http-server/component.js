import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {

    // protected
    async _install () {
        return new Server();
    }

    async _postRun () {
        const publicHttpServer = this.components.get( "publicHttpServer" );

        var port = this.config.port;

        if ( publicHttpServer ) {
            const publicHttpServerPort = publicHttpServer.config.port;

            if ( publicHttpServerPort && publicHttpServerPort === port ) {
                if ( publicHttpServerPort === 80 ) {
                    port = 81;
                }
                else {
                    return result( [500, `Public and private HTTP servers ports are the same`] );
                }
            }
        }

        const res = await this.value.listen( {
            "address": this.config.address,
            "port": port,
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
        await this.value.stop();
    }
}
