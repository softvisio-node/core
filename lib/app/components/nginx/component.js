import Component from "#lib/app/component";
import Nginx from "./nginx.js";

export default class extends Component {

    // properties
    get storageLocationsConfig () {
        return {
            [this.config.storageLocation]: {
                "private": true,
            },
            [this.instance.acmeChallengesLocation]: {
                "private": false,
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
        if ( this.instance.acmeChallengesUrl && this.app.privateHttpServer ) {
            this.app.privateHttpServer.head( this.instance.acmeChallengesUrl + "/test", req => {
                req.end( {
                    "status": 200,

                    "headers": {
                        "x-acme-test": req.headers.get( "x-acme-test" ),
                    },
                } );
            } );
        }

        return result( 200 );
    }

    async _afterAppStarted () {
        return this.instance.start();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
