import Component from "#lib/app/component";
import Rpc from "#lib/app/components/rpc/rpc";

export default class extends Component {

    // protected
    async _install () {
        return new Rpc( this.app, this.config, this.components.getSchema.bind( this.components, "rpc" ) );
    }

    async _init () {
        return this.value.init();
    }

    async _run () {
        return this.value.run();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
