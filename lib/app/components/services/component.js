import Services from "./services.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return !!Object.keys( this.config ).length;
        }

        async _install () {
            const services = new Services( this.config );

            return services;
        }

        async _start () {

            // this.instance.addServices( this.config );

            return result( 200 );
        }
    };
