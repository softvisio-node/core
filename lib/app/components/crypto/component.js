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

        async _init () {
            return this.instance.init();
        }
    };
