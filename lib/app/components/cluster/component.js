import Cluster from "./cluster.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return this.config.enabled;
        }

        async _install () {
            return new Cluster( this.app, this.config );
        }

        async _configure () {
            return this.instance.configure();
        }

        async _init () {
            var res;

            res = await this.instance.init();
            if ( !res.ok ) return res;

            process.stdout.write( "Connecting to the cluster ... " );

            await this.instance.waitConnect();

            console.log( "connected" );

            return result( 200 );
        }
    };
