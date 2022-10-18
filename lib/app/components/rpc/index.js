import Component from "#lib/app/component";
import Rpc from "#lib/app/rpc";

export default class extends Component {

    // protected
    async _install () {
        return new Rpc( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }

    async _run () {
        return this.value.run();
    }
}
