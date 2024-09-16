import Cluster from "./cluster.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return this.config.id && this.config.apiUrl;
        }

        async _install () {
            return new Cluster( this.config.id, this.config.apiUrl );
        }

        async _init () {
            process.stdout.write( "Connecting to the cluster ... " );

            await this.instance.waitConnect();

            console.log( "connected" );

            return result( 200 );
        }
    };
