import Rpc from "#lib/app/components/rpc/rpc";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Rpc( this.app, this.config );
        }

        async _configureInstance () {
            const schema = this.components.getSchema( "rpc" );
            if ( !schema.ok ) return schema;

            return this.instance.configure( schema.data );
        }

        async _init () {
            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _destroy () {
            await this.instance.destroy();
        }
    };
