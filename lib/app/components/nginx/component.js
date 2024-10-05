import env from "#lib/env";
import Nginx from "./nginx.js";

export default Super =>
    class extends Super {

        // protected
        async _configure () {
            if ( this.config.acme.enabled ) {
                if ( !this.config.acme.email ) {
                    return result( [ 500, `Nginx ACME email is required` ] );
                }

                env.loadUserEnv();

                const dnsEnabled = this.config.acme.cloudFlareApiToken || process.env.CLOUDFLARE_TOKEN || ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL );

                if ( !this.config.acme.httpEnabled && !dnsEnabled ) {
                    return result( [ 500, `Nginx ACME httpEnabled or cloudFlareApiToken are required` ] );
                }
            }

            return result( 200 );
        }

        async _checkEnabled () {
            return this.isRequired && process.platform === "linux";
        }

        async _install () {
            return new Nginx( this.app, this.config );
        }

        async _configureInstance () {
            if ( this.config.acme.enabled && !this.app.crypto ) {
                return result( [ 400, `Ctypto component is required for nginx ACME` ] );
            }

            if ( !this.app.dbh ) {
                this.config.acme.useLocalStorage = true;
            }

            return result( 200 );
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
