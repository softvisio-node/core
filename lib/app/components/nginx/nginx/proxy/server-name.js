import crypto from "node:crypto";
import fs from "node:fs";
import { createCertificate } from "#lib/certificates";
import Interval from "#lib/interval";
import { TmpFile } from "#lib/tmp";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class NginxProxyServerName {
    #nginx;
    #serverNames;
    #name;
    #certificatePath;
    #privateKeyPath;
    #certificateFingerprint;
    #renewInterval;
    #isSelfSignedCertificate;

    constructor ( nginx, serverNames, name ) {
        this.#nginx = nginx;
        this.#serverNames = serverNames;
        this.#name = name || "";
    }

    // properties
    get app () {
        return this.#nginx.app;
    }

    get nginx () {
        return this.#nginx;
    }

    get name () {
        return this.#name;
    }

    get isDefaultServerName () {
        return !this.#name;
    }

    get isSelfSignedCertificate () {
        return this.#isSelfSignedCertificate;
    }

    get certificatePath () {
        return this.#certificatePath;
    }

    get privateKeyPath () {
        return this.#privateKeyPath;
    }

    // public
    async updateCertificate () {

        // schedule renew
        this.#renewInterval ??= setInterval( this.#renewCertificate.bind( this, true ), renewInterval );

        return this.#renewCertificate();
    }

    delete () {

        // clear renew interval
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        // delete certificate files
        this.#certificateFingerprint = null;
        this.#certificatePath = null;
        this.#privateKeyPath = null;

        this.#isSelfSignedCertificate = null;

        this.#serverNames.delete( this.#name );

        return this;
    }

    toString () {
        return this.#name;
    }

    toJSON () {
        return this.#name;
    }

    // private
    get #canGetCertificate () {
        if ( this.isDefaultServerName ) return false;

        if ( this.app.nginxupstream ) {
            return true;
        }
        else if ( this.app.acme ) {
            return this.app.acme.canGetCertificate( this.#name );
        }
        else {
            return false;
        }
    }

    async #renewCertificate ( renew ) {
        const fingerprint = this.#certificateFingerprint;

        if ( ( !fingerprint || renew || this.isSelfSignedCertificate ) && this.#canGetCertificate ) {
            await this.#createCertificate();
        }

        // generate self-signed certificate
        if ( !this.#certificateFingerprint ) {
            await this.#createSelfSignedCertificate();
        }

        // reload nginx if certificate was updated
        if ( renew && fingerprint !== this.#certificateFingerprint ) this.nginx.reload();
    }

    async #createCertificate () {
        var res;

        if ( this.app.nginxUpstream ) {
            res = await this.app.nginxUpstream.getCertificate( this.#name );

            if ( res.ok ) {

                // certificate updated
                if ( this.#certificateFingerprint !== res.data[ this.#name ].fingerprint ) {
                    this.#isSelfSignedCertificate = false;
                    this.#certificateFingerprint = res.data[ this.#name ].fingerprint;

                    this.#certificatePath = new TmpFile();
                    await fs.promises.writeFile( this.#certificatePath.path, res.data[ this.#name ].certificate );

                    this.#privateKeyPath = new TmpFile();
                    await fs.promises.writeFile( this.#certificatePath.path, res.data[ this.#name ].privateKey );
                }
            }
        }
        else if ( this.app.acme ) {
            res = await this.app.acme.getCertificate( this.#name );

            if ( res.ok ) {

                // certificate updated
                if ( this.#certificateFingerprint !== res.data.fingerprint ) {
                    this.#isSelfSignedCertificate = false;
                    this.#certificateFingerprint = res.data.fingerprint;
                    this.#certificatePath = res.data.certificatePath;
                    this.#privateKeyPath = res.data.privateKeyPath;
                }
            }
        }
        else {
            res = result( 500 );
        }

        if ( !res.ok ) {
            console.warn( `Nginx get certificate for server name: ${ this.#name }, error: ${ res }` );
        }
    }

    async #createSelfSignedCertificate () {
        const { certificate, privateKey } = await createCertificate( {
            "domains": this.#name,
        } );

        this.#isSelfSignedCertificate = true;
        this.#certificateFingerprint = new crypto.X509Certificate( certificate ).fingerprint512;

        this.#certificatePath = new TmpFile();
        await fs.promises.writeFile( this.#certificatePath.path, certificate );

        this.#privateKeyPath = new TmpFile();
        await fs.promises.writeFile( this.#privateKeyPath.path, privateKey );
    }
}
