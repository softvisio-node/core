import Component from "#lib/app/component";
import Env from "./env.js";

export default class extends Component {

    // protected
    async _install () {
        return new Env( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }
}
