import Component from "#lib/app/component";
import Healthcheck from "./healthcheck.js";

export default class extends Component {

    // protected
    async _install () {
        return new Healthcheck( this.app, this.components );
    }
}
