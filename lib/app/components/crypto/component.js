import Crypto from "./crypto.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return !!this.config.key;
        }

        async _install () {
            return new Crypto( this.app, this.config );
        }

        async _configure () {
            if ( !this.config.useLocalStorage ) {
                if ( !this.app.dbh ) {
                    return result( [ 400, "DBH component is required" ] );
                }

                if ( !this.app.cluster ) {
                    return result( [ 400, "Cluster component is required" ] );
                }
            }

            return result( 200 );
        }

        async _init () {
            return this.instance.init();
        }
    };
