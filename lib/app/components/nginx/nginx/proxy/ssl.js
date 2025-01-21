import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class nginxProxySsl {
    #server;
    #renewInterval;
    #certificates = {};
    #updateRequired = true;

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

    // public
    getCertificate ( serverName ) {
        return this.#certificates[ serverName ];
    }

    async update () {

        // schedule renew
        this.#renewInterval ??= setInterval( this.#getCertificates.bind( this, true ), renewInterval );

        // update is not required
        if ( !this.#updateRequired ) return;

        await this.#getCertificates();
    }

    clear () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificates = {};
    }

    // private
    async #getCertificates ( renew ) {
        this.#updateRequired = false;

        if ( !this.#server.serverName ) return;

        var renewed;

        const certificates = {};

        for ( const serverName of this.#server.serverName ) {

            // ACME certificate
            if ( this.#canGetCertificate( serverName ) ) {
                certificates[ serverName ] = this.#certificates[ serverName ]
                    ? structuredClone( this.#certificates[ serverName ] )
                    : {
                        "isSelfSigned": true,
                        "fingerprint": null,
                        "certificatePath": this.nginx.defaultCertificate.certificatePath,
                        "privateKeyPath": this.nginx.defaultCertificate.privateKeyPath,
                    };

                const res = await this.app.acme.getCertificate( serverName );

                if ( res.ok ) {

                    // certificate changed
                    if ( res.data.fingerprint !== certificates[ serverName ].fingerprint ) {
                        certificates[ serverName ] = {
                            "isSelfSigned": false,
                            "fingerprint": res.data.fingerprint,
                            "certificatePath": res.data.certificatePath,
                            "privateKeyPath": res.data.privateKeyPath,
                        };
                    }
                }
                else {
                    this.#updateRequired = true;

                    console.warn( `Nginx get certificates for domains: ${ serverName }, error: ${ res }` );
                }
            }

            // self-signed certificate
            else {
                certificates[ serverName ] = {
                    "isSelfSigned": true,
                    "fingerprint": null,
                    "certificatePath": this.nginx.defaultCertificate.certificatePath,
                    "privateKeyPath": this.nginx.defaultCertificate.privateKeyPath,
                };
            }

            // renewed
            if ( certificates[ serverName ].fingerprint !== this.#certificates[ serverName ]?.fingerprint ) renewed = true;
        }

        this.#certificates = certificates;

        if ( renew && renewed ) this.nginx.reload();
    }

    #canGetCertificate ( serverName ) {
        if ( !this.app.acme ) return false;

        return this.app.acme.canGetCertificate( serverName );
    }
}
