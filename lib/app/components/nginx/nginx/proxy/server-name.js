import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class NginxProxyServerName {
    #serverNames;
    #name;
    #certificatePath;
    #privateKeyPath;
    #certificateFingerprint;
    #renewInterval;

    constructor ( serverNames, name ) {
        this.#serverNames = serverNames;
        this.#name = name || "";
    }

    // properties
    get app () {
        return this.#serverNames.app;
    }

    get nginx () {
        return this.#serverNames.nginx;
    }

    get name () {
        return this.#name;
    }

    get isDefaultServerName () {
        return Boolean( this.#name );
    }

    get certificatePath () {
        return this.#certificatePath || this.nginx.defaultCertificate.certificatePath;
    }

    get privateKeyPath () {
        return this.#privateKeyPath || this.nginx.defaultCertificate.privateKeyPath;
    }

    get isSelfSignedCertificate () {
        return this.#privateKeyPath
            ? false
            : true;
    }

    // public
    async updateCertificate () {

        // schedule renew
        this.#renewInterval ??= setInterval( this.#getCertificate.bind( this, true ), renewInterval );

        // certs already exists
        if ( this.#certificateFingerprint ) return;

        await this.#getCertificate();
    }

    delete () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificateFingerprint = null;
        this.#certificatePath = null;
        this.#privateKeyPath = null;

        this.#serverNames.delete( this.#name );

        return this;
    }

    // private
    async #getCertificate ( renew ) {
        if ( !this.#canGetCertificate ) return;

        const res = await this.app.acme.getCertificate( this.#name );

        if ( res.ok ) {

            // not updated
            if ( this.#certificateFingerprint === res.data.fingerprint ) return;

            this.#certificateFingerprint = res.data.fingerprint;
            this.#certificatePath = res.data.certificatePath;
            this.#privateKeyPath = res.data.privateKeyPath;

            if ( renew ) this.nginx.reload();
        }
        else {
            console.warn( `Nginx get certificates for domain: ${ this.#name }, error: ${ res }` );
        }
    }

    get #canGetCertificate () {
        if ( !this.app.acme ) return false;

        return this.app.acme.canGetCertificate( this.#name );
    }
}
