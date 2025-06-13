import Nginx from "./nginx.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return this.isRequired && process.platform === "linux";
        }

        async _install () {
            return new Nginx( this.app, this.config );
        }

        async _afterAppStarted () {
            return this.instance.start();
        }

        async _destroy () {
            return this.instance.destroy();
        }
    };
