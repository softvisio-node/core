import Services from "./services.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return !!Object.keys( this.config ).length;
        }

        async _install () {
            return new Services( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };
