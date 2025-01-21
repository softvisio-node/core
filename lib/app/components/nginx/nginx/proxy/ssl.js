import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class NginxProxySsl {
    #server;
    #certificatePath;
    #privateKeyPath;
    #certificateFingerprint;
    #renewInterval;

    constructor ( server ) {
        this.#server = server;
    }

    // properties
    get app () {
        return this.nginx.app;
    }

    get server () {
        return this.#server;
    }

    get nginx () {
        return this.#server.nginx;
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
    async update () {

        // schedule renew
        this.#renewInterval ??= setInterval( this.#getCertificate.bind( this, true ), renewInterval );

        // certs already exists
        if ( this.#certificateFingerprint ) return;

        await this.#getCertificate();
    }

    destroy () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificateFingerprint = null;
        this.#certificatePath = null;
        this.#privateKeyPath = null;
    }

    // private
    async #getCertificate ( renew ) {
        if ( !this.#canGetCertificate ) return;

        const res = await this.app.acme.getCertificate( this.#server.serverName );

        if ( res.ok ) {

            // not updated
            if ( this.#certificateFingerprint === res.data.fingerprint ) return;

            this.#certificateFingerprint = res.data.fingerprint;
            this.#certificatePath = res.data.certificatePath;
            this.#privateKeyPath = res.data.privateKeyPath;

            if ( renew ) this.nginx.reload();
        }
        else {
            console.warn( `Nginx get certificates for domains: ${ this.#server.serverName }, error: ${ res }` );
        }
    }

    get #canGetCertificate () {
        if ( !this.app.acme ) return false;

        return this.app.acme.canGetCertificate( this.#server.serverName );
    }
}
