import Component from "#lib/app/component";
import Cluster from "./cluster.js";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return this.config.id && this.config.apiUrl;
    }

    async _install () {
        return new Cluster( this.config.id, this.config.apiUrl );
    }

    async _start () {
        process.stdout.write( "Connecting to the cluster ... " );

        await this.value.waitConnect();

        console.log( "connected" );

        return result( 200 );
    }
}
