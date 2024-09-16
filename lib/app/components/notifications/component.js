import Notifications from "./notifications.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Notifications( this.app, this.config );
        }

        async _configureInstance () {
            return this.instance.configure();
        }

        async _init () {
            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _shutDown () {
            return this.instance.shutDown();
        }
    };
