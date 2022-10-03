import Component from "#lib/app//component";
import Cluster from "./cluster.js";

export default class extends Component {

    // protected
    async _install () {
        const api = this.components.get( "services" ).get( "core" );

        if ( !api ) return result( [400, `Core service is required to use cluster`] );

        return new Cluster( this.config.id, api );
    }

    async _run () {
        process.stdout.write( "Connecting to the cluster ... " );

        const res = await this.value.waitConnect();

        console.log( res + "" );

        return res;
    }
}
