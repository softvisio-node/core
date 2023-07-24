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
}
