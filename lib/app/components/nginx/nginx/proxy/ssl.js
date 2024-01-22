import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class nginxProxySsl {
    #server;
    #certificate;
    #privateKey;
    #certificateFingerprint;
    #renewInterval;

    constructor ( server ) {
        this.#server = server;
    }

    // properties
    get server () {
        return this.#server;
    }

    get nginx () {
        return this.#server.nginx;
    }

    get certificate () {
        return this.#certificate || this.nginx.defaultCertificate.certificate;
    }

    get privateKey () {
        return this.#privateKey || this.nginx.defaultCertificate.privateKey;
    }

    get canGetCertificate () {
        return this.nginx.acme?.canGetCertificate( this.#server.serverName );
    }

    // public
    async update () {

        // schedule renew
        this.#renewInterval ??= setInterval( this.#getCertificate.bind( this, true ), renewInterval );

        // certs already exists
        if ( this.#certificateFingerprint ) return;

        await this.#getCertificate();
    }

    clear () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificateFingerprint = null;
        this.#certificate = null;
        this.#privateKey = null;
    }

    // private
    async #getCertificate ( renew ) {
        if ( !this.canGetCertificate ) return;

        const res = await this.nginx.acme.getCertificate( this.#server.serverName );

        if ( res.ok ) {

            // not updated
            if ( this.#certificateFingerprint === res.data.fingerprint ) return;

            console.info( `Nginx updated certificates for server "${this.#server.serverName}"` );

            this.#certificateFingerprint = res.data.fingerprint;
            this.#certificate = res.data.certificate;
            this.#privateKey = res.data.privateKey;

            if ( renew ) this.nginx.reload();
        }
        else {
            console.warn( `Nginx get certificates for server "${this.#server.serverName}" failed: ${res}` );
        }
    }
}
