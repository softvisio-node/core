import Interval from "#lib/interval";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

export default class nginxProxySsl {
    #server;
    #certificate;
    #certificateKey;
    #certificateHash;
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

    get certificateKey () {
        return this.#certificateKey || this.nginx.defaultCertificate.privateKey;
    }

    get canGetCertificate () {
        return this.nginx.acme?.canGetCertificate( this.#server.serverName );
    }

    // public
    async update () {
        if ( !this.canGetCertificate ) return;

        // certs already exists
        if ( this.#certificateHash ) return;

        this.clear();

        await this.#getCertificate();

        // schedule renew
        this.#renewInterval = setInterval( this.#getCertificate.bind( this, true ), renewInterval );
    }

    clear () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificateHash = null;
        this.#certificate = "";
        this.#certificateKey = "";
    }

    // private
    async #getCertificate ( renew ) {
        const res = await this.nginx.acme.getCertificate( this.#server.serverName );

        if ( res.ok ) {

            // not updated
            if ( this.#certificateHash === res.data.hash ) return;

            console.info( `Nginx updated certificates for server "${this.#server.serverName}"` );

            this.#certificateHash = res.data.hash;
            this.#certificate = res.data.certificate;
            this.#certificateKey = res.data.key;

            if ( renew ) this.nginx.reload();
        }
        else {
            console.warn( `Nginx get certificates for server "${this.#server.serverName}" failed: ${res}` );
        }

        return res;
    }
}
