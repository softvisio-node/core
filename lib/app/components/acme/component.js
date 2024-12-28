import env from "#lib/env";
import Acme from "./acme.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Acme( this.app, this.config );
        }

        async _configureInstance () {

            // configure useLocalStorage
            if ( this.config.useLocalStorage == null ) {
                if ( this.app.dbh && this.app.cluster ) {
                    this.config.useLocalStorage = false;
                }
                else {
                    this.config.useLocalStorage = true;
                }
            }

            // check useLocalStorage
            if ( !this.config.useLocalStorage ) {
                if ( !this.app.dbh ) {
                    return result( [ 400, "DBH component is required to use shared storage" ] );
                }

                if ( !this.app.cluster ) {
                    return result( [ 400, "Cluster component is required to use shared storage" ] );
                }
            }

            // configure dnsEnabled
            if ( this.config.dnsEnabled == null ) {
                if ( this.config.cloudFlareApiToken ) {
                    this.config.dnsEnabled = true;
                }
                else {
                    env.loadUserEnv();

                    this.config.dnsEnabled = Boolean( process.env.CLOUDFLARE_TOKEN || ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL ) );
                }
            }

            // configure httpEnabled
            if ( this.config.httpEnabled == null ) {
                if ( this.app.privateHttpServer || this.app.publicHttpServer ) {
                    this.config.httpEnabled = true;
                }
                else {
                    this.config.httpEnabled = false;
                }
            }

            // check HTTP and DNS
            if ( !this.config.httpEnabled && !this.config.dnsEnabled ) {
                return result( [ 500, `HTTP or DNS should be enabled` ] );
            }

            return result( 200 );
        }

        async _init () {
            return this.instance.init();
        }
    };
