import Component from "#lib/app/component";
import Monitoring from "./monitoring.js";

export default class extends Component {

    // protected
    async _install () {
        return new Monitoring( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
