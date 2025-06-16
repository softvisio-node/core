import Acme from "./acme.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Acme( this.app, this.config );
        }

        async _configure () {
            return this.instance.configure();
        }

        async _init () {
            return this.instance.init();
        }
    };
