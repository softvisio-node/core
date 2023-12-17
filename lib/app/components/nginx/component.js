import Component from "#lib/app/component";
import Nginx from "./nginx.js";

export default class extends Component {

    // properties
    get storageLocationsConfig () {
        return {
            [this.config.storageLocation]: {
                "private": true,
            },
        };
    }

    // protected
    async _checkEnabled () {
        return this.isRequired && process.platform === "linux";
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
