import Interval from "#lib/interval";
import { resolve } from "#lib/utils";

const renewInterval = new Interval( "1 day" ).toMilliseconds();

const defaultCertificate = resolve( "../../resources/default.crt.pem", import.meta.url ),
    defaultCertificateKey = resolve( "../../resources/default.key.pem", import.meta.url );

export default class nginxUpstreamSsl {
    #nginx;
    #serverName;
    #certificate;
    #certificateKey;
    #certificateHash;
    #renewInterval;

    constructor ( nginx, serverName ) {
        this.#nginx = nginx;
        this.#serverName = serverName;
    }

    // properties
    get serverName () {
        return this.#serverName;
    }

    get certificate () {
        return this.#certificate || defaultCertificate;
    }

    get certificateKey () {
        return this.#certificateKey || defaultCertificateKey;
    }

    // public
    async update () {
        if ( !this.#nginx.acme.canGetCertificate( this.#serverName ) ) return;

        // certs already exists
        if ( this.#certificateHash ) return;

        const res = await this.#nginx.acme.getCertificate( this.#serverName );

        this.clear();

        if ( res.ok ) {
            this.#certificateHash = res.data.hash;
            this.#certificate = res.data.certificate;
            this.#certificateKey = res.data.key;
        }
        else {
            console.log( `Nginx get certificates for server "${this.#serverName}" failed: ${res}` );
        }

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
        const res = await this.#nginx.acme.getCertificate( this.#serverName );

        if ( !res.ok ) return;

        // not updated
        if ( this.#certificateHash === res.data.hash ) return;

        this.#certificateHash = res.data.hash;
        this.#certificate = res.data.certificate;
        this.#certificateKey = res.data.key;

        this.#nginx.reload();
    }
}
