import Component from "#lib/app/component";
import Rpc from "#lib/app/components/rpc/rpc";

export default class extends Component {

    // protected
    async _install () {
        return new Rpc( this.app, this.config );
    }

    async _configureInstance () {
        const schema = this.components.getSchema( "rpc" );
        if ( !schema.ok ) return schema;

        return this.value.configure( schema.data );
    }

    async _init () {
        return this.value.init();
    }

    async _start () {
        return this.value.start();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
