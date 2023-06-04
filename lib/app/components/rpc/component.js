import Component from "#lib/app/component";
import Rpc from "#lib/app/components/rpc/rpc";

export default class extends Component {

    // protected
    async _install () {
        return new Rpc( this.app, this.config );
    }

    async _configureInstance () {
        return this.value.configure();
    }

    async _init () {
        const schema = this.components.getSchema( "rpc" );
        if ( !schema.ok ) return schema;

        return this.value.init( schema.data );
    }

    async _run () {
        return this.value.run();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
