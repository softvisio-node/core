import Component from "#lib/app/component";
import Nginx from "./nginx.js";

export default class extends Component {

    // properties
    get storageLocationsConfig () {
        return {
            [ this.config.storageLocation ]: {
                "private": true,
                "encrrypt": true,
            },
            [ this.instance.acmeChallengesStorageLocation ]: {
                "private": false,
                "encrrypt": false,
                "maxAge": "10 minutes",
                "cacheControl": "no-cache",
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

    async _init () {
        return this.instance.init();
    }

    async _afterAppStarted () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
