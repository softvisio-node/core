import Nginx from "./nginx.js";
import env from "#lib/env";

export default Super =>
    class extends Super {

        // protected
        async _configure () {
            env.loadUserEnv();

            const cloudFlareEnabled = this.config.acme.cloudFlareApiToken || process.env.CLOUDFLARE_TOKEN || ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL );

            if ( !this.config.acme.email || !( this.config.acme.httpAuthorizationEnabled || cloudFlareEnabled ) ) {
                this.config.acme.enabled = false;
            }

            // XXX
            console.log( this.config.acme );
            console.log( "---------", this.config.acme.enabled );
            console.log( this.components.get( "crypto" ) );
            process.exit();

            if ( this.config.acme.enabled && !this.components.get( "crypto" ) ) {
                return result( [ 400, `Ctypto component is required for nginx ACME` ] );
            }

            if ( !this.app.dbh ) {
                this.config.acme.useLocalStorage = true;
            }

            return result( 200 );
        }

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
