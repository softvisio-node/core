import Payments from "./payments.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Payments( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };
