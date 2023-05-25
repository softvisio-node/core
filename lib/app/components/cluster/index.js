import Component from "#lib/app/component";
import Cluster from "./cluster.js";

export default class extends Component {

    // protected
    async _install () {

        // cluster is not configured
        if ( !this.config.id || !this.config.apiUrl ) return;

        return new Cluster( this.config.id, this.config.apiUrl );
    }

    async _run () {

        // cluster is not configured
        if ( !this.value ) return result( 200 );

        process.stdout.write( "Connecting to the cluster ... " );

        await this.value.waitConnect();

        console.log( "connected" );

        return result( 200 );
    }
}
