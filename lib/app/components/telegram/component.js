import Component from "#lib/app/component";
import Telegram from "./telegram.js";

export default class extends Component {

    // protected
    async _install () {
        return new Telegram( this.app, this, this.config );
    }

    async _init () {
        return this.value.init();
    }

    async _start () {
        return this.value.start();
    }

    async _shutDown () {
        return this.value.shutDown();
    }
}
