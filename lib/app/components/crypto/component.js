import Component from "#lib/app/component";
import Crypto from "./crypto.js";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return !!this.config.privateKey;
    }

    async _install () {
        return new Crypto( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }
}
