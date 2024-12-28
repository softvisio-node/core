import env from "#lib/env";
import Acme from "./acme.js";

export default Super =>
    class extends Super {

        // protected
        async _configure () {
            if ( !this.config.email ) {
                return result( [ 500, `Email is required` ] );
            }

            env.loadUserEnv();

            const dnsEnabled = this.config.cloudFlareApiToken || process.env.CLOUDFLARE_TOKEN || ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL );

            if ( !this.config.httpEnabled && !dnsEnabled ) {
                return result( [ 500, `ACME httpEnabled or cloudFlareApiToken are required` ] );
            }

            return result( 200 );
        }

        async _install () {
            return new Acme( this.app, this.config );
        }

        async _configureInstance () {
            if ( this.config.useLocalStorage == null ) {
                if ( this.app.dbh && this.app.cluster ) {
                    this.config.useLocalStorage = true;
                }
                else {
                    this.config.useLocalStorage = false;
                }
            }

            if ( !this.config.useLocalStorage ) {
                if ( !this.app.dbh ) {
                    return result( [ 400, "DBH component is required for nginx ACME" ] );
                }

                if ( !this.app.cluster ) {
                    return result( [ 400, "Cluster component is required for nginx ACME" ] );
                }
            }

            return result( 200 );
        }

        async _init () {
            return this.instance.init();
        }
    };
