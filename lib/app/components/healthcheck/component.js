import Healthcheck from "./healthcheck.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Healthcheck( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }

        async _afterAppStarted () {
            return this.instance.start();
        }

        async _shutDown () {
            return this.instance.stop();
        }
    };
