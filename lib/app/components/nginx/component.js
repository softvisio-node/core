import Nginx from "./nginx.js";

export default Super =>
    class extends Super {

        // properties
        get storageLocationsConfig () {
            return {
                [ this.config.storageLocation ]: {
                    "private": true,
                    "encrypt": true,
                },
                [ this.instance.acmeChallengesStorageLocation ]: {
                    "private": false,
                    "encrypt": false,
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
    };
