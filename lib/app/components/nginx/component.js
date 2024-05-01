import Nginx from "./nginx.js";

export default Super =>
    class extends Super {

        // protected
        async _coonfigure () {
            if ( !this.app.dbh ) {
                this.config.acmeuseLocalStorage = true;
            }

            return result( 200 );
        }

        async _checkEnabled () {
            return this.isRequired && process.platform === "linux";
        }

        async _install () {
            return new Nginx( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }

        async _afterAppStarted () {
            return this.instance.start();
        }

        async _shutDown () {
            return this.instance.shutDown();
        }
    };
