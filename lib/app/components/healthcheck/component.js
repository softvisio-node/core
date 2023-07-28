import Component from "#lib/app/component";
import Healthcheck from "./healthcheck.js";

export default class extends Component {

    // protected
    async _install () {
        return new Healthcheck( this.app, this.config );
    }

    async _postStart () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
