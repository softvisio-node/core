import Component from "#lib/app/component";
import Monitoring from "./monitoring.js";

export default class extends Component {

    // protected
    async _install () {
        return new Monitoring( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }

    async _run () {
        return this.value.run();
    }

    async _shutDown () {
        return this.value.shutDown();
    }
}
