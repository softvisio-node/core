import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {

    // protected
    async _install () {
        return new Server();
    }

    async _run () {
        const res = await this.value.listen( {
            "address": this.config.address,
            "port": this.config.port,
            "exclusive": this.config.exclusive,
        } );

        this.config.port = res.data.port;

        if ( res.ok ) {
            console.log( `Public HTTP server listening at: ${res.data.address}:${res.data.port}` );

            const lock = process.shutdown.lock( "public http server" );

            process.shutdown.on( "shutdown", async () => {
                await this.value.stop();

                lock.done();
            } );
        }
        else {
            console.log( `Public HTTP server unable bind to the ${res.data.address}:${res.data.port}` );
        }

        return res;
    }
}
