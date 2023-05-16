import Component from "#lib/app//component";
import Cluster from "./cluster.js";

export default class extends Component {

    // protected
    async _install () {

        // cluster is not configured
        if ( !this.config.id ) return;

        const api = this.components.get( "services" ).get( this.config.serviceName );

        if ( !api ) return result( [400, `Cluster service is required to use cluster`] );

        return new Cluster( this.config.id, api );
    }

    async _run () {

        // cluster is not configured
        if ( !this.value ) return result( 200 );

        process.stdout.write( "Connecting to the cluster ... " );

        const res = await this.value.waitConnect();

        console.log( res + "" );

        return res;
    }
}
