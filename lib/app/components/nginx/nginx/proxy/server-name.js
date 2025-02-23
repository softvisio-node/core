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

    get isSelfSignedCertificate () {
        return this.#certificateFingerprint
            ? false
            : true;
    }

    get certificatePath () {
        return this.#certificatePath || this.nginx.defaultCertificate.certificatePath;
    }

    get privateKeyPath () {
        return this.#privateKeyPath || this.nginx.defaultCertificate.privateKeyPath;
    }

    // public
    async updateCertificate () {
        if ( this.isDefaultServerName ) return;

        // schedule renew
        this.#renewInterval ??= setInterval( this.#getCertificate.bind( this, true ), renewInterval );

        // certificate already exists
        if ( this.#certificateFingerprint ) return;

        return this.#getCertificate();
    }

    delete () {
        if ( !this.isDefaultServerName ) {
            clearInterval( this.#renewInterval );
            this.#renewInterval = null;

            this.#deleteCertificate();

            this.#serverNames.delete( this.#name );
        }

        return this;
    }

    // private
    async #getCertificate ( reload ) {
        if ( this.#canGetCertificate ) {
            const res = await this.app.acme.getCertificate( this.#name );

            if ( res.ok ) {

                // certificate updated
                if ( this.#certificateFingerprint !== res.data.fingerprint ) {
                    this.#certificateFingerprint = res.data.fingerprint;
                    this.#certificatePath = res.data.certificatePath;
                    this.#privateKeyPath = res.data.privateKeyPath;

                    if ( reload ) this.nginx.reload();
                }
            }
            else {
                console.warn( `Nginx get certificate for server name: ${ this.#name }, error: ${ res }` );
            }
        }

        // unable to get certificate for server name
        else {
            this.#deleteCertificate();
        }
    }

    get #canGetCertificate () {
        if ( !this.app.acme ) return false;

        return this.app.acme.canGetCertificate( this.#name );
    }

    #deleteCertificate () {
        this.#certificateFingerprint = null;
        this.#certificatePath = null;
        this.#privateKeyPath = null;
    }
}
