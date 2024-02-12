import ApiServices from "#lib/api/services";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return !!Object.keys( this.config ).length;
        }

        async _install () {
            const services = new ApiServices( this.config );

            return services;
        }

        async _start () {

            // this.instance.addServices( this.config );

            return result( 200 );
        }
    };
