import Component from "#core/app/component";
import Nginx from "./nginx.js";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return this.isRequired;
    }

    async _install () {
        return new Nginx( this.app, this.config );
    }

    async _start () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
