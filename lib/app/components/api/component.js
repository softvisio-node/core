import Api from "#lib/app/components/api/api";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Api( this.app, this.config );
        }

        async _configureInstance () {
            const schema = this.components.getSchema( "api" );
            if ( !schema.ok ) return schema;

            return this.instance.configure( schema.data );
        }

        async _init () {
            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _shutDown () {
            await this.instance.shutDown();
        }
    };
