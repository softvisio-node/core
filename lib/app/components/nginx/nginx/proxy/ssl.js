import Interval from "#lib/interval";
import { resolve } from "#lib/utils";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

const defaultCertificate = resolve( "../../resources/default.crt.pem", import.meta.url ),
    defaultCertificateKey = resolve( "../../resources/default.key.pem", import.meta.url );

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
        return this.#certificate || defaultCertificate;
    }

    get certificateKey () {
        return this.#certificateKey || defaultCertificateKey;
    }

    get canGetCertificate () {
        return this.nginx.acme.canGetCertificate( this.#server.serverName );
    }

    // public
    async update () {
        if ( !this.canGetCertificate ) return;

        // certs already exists
        if ( this.#certificateHash ) return;

        const res = await this.nginx.acme.getCertificate( this.#server.serverName );

        this.clear();

        if ( res.ok ) {
            this.#certificateHash = res.data.hash;
            this.#certificate = res.data.certificate;
            this.#certificateKey = res.data.key;
        }
        else {
            console.log( `Nginx get certificates for server "${this.#server.serverName}" failed: ${res}` );
        }

        // schedule renew
        this.#renewInterval = setInterval( this.#renew.bind( this ), renewInterval );
    }

    clear () {
        clearInterval( this.#renewInterval );
        this.#renewInterval = null;

        this.#certificateHash = null;
        this.#certificate = "";
        this.#certificateKey = "";
    }

    // private
    async #renew () {
        const res = await this.nginx.acme.getCertificate( this.#server.serverName );

        if ( !res.ok ) return;

        // not updated
        if ( this.#certificateHash === res.data.hash ) return;

        this.#certificateHash = res.data.hash;
        this.#certificate = res.data.certificate;
        this.#certificateKey = res.data.key;

        this.nginx.reload();
    }
}
