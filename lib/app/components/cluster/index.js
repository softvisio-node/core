import Component from "#lib/app/component";
import Cluster from "./cluster.js";

export default class extends Component {

    // protected
    async _configure () {
        if ( !this.config.id || !this.config.apiUrl ) return result( 200, false );

        return result( 200 );
    }

    async _install () {
        return new Cluster( this.config.id, this.config.apiUrl );
    }

    async _run () {
        process.stdout.write( "Connecting to the cluster ... " );

        await this.value.waitConnect();

        console.log( "connected" );

        return result( 200 );
    }
}
