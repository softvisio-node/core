import Component from "#lib/app/component";
import Acl from "./acl.js";

export default class extends Component {

    // protected
    async _install () {
        return new Acl( this.app, this.config );
    }

    async _configureInstance () {
        return this.instance.configure();
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

    async _getAcl () {
        return this.config.types;
    }
}
