import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #cloudFlare;

    constructor ( nginx ) {
        this.#nginx = nginx;

        if ( this.#nginx.config.clodFlare?.apiKey && this.#nginx.config.clodFlare?.email ) {
            this.#cloudFlare = new CloudFlare( this.#nginx.config.clodFlare?.apiKey, this.#nginx.config.clodFlare?.email );
        }
        else if ( process.env.CLOUDFLARE_TOKEN && process.env.CLOUDFLARE_EMAIL ) {
            this.#cloudFlare = new CloudFlare( process.env.CLOUDFLARE_TOKEN, process.env.CLOUDFLARE_EMAIL );
        }
    }

    // public
    async getCertificates ( domains ) {
        this.#acme ??= await this.#getAcme();

        if ( !this.#acme ) return result( [400, `ACE not availeble`] );

        const res = await this.#acme.getCertificate( {
            domains,
            "createChallenge": this.#createChallenge.bind( this ),
            "deleteChallenge": this.#deleteChallenge.bind( this ),
        } );

        await this.#storeAccountKey( this.#acme.accountKey );

        return res;
    }

    // private
    async #getAcme () {
        if ( !this.#nginx.config.acme?.email ) return;

        return new Acme( {
            "provider": "letsencrypt",
            "test": false,
            "email": this.#nginx.config.acme?.email,
            "accountKey": await this.#getAccountKey(),
        } );
    }

    async #getAccountKey () {
        return null;
    }

    async #storeAccountKey ( accountKey ) {}

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, content } ) {
        if ( type !== "dns-01" ) return false;

        if ( !this.#cloudFlare ) return;

        var res;

        res = await !this.#cloudFlare.getZones();
        if ( !res.ok ) return;

        var zone;

        for ( const row of res.data ) {
            if ( domain === row.name || domain.endsWith( `.${row.name}` ) ) {
                zone = row;

                break;
            }
        }

        // zone not found
        if ( !zone ) return;

        res = await !this.#cloudFlare.createDnsRecord( zone.id, {
            "type": "TXT",
            "name": dnsTxtRecordName,
            content,
            "ttl": 60,
        } );

        if ( !res.ok ) return;

        return true;
    }

    async #deleteChallenge ( { type, domain, dnsTxtRecordName, httpLocation } ) {
        if ( type !== "dns-01" ) return;

        if ( this.#cloudFlare ) return;

        var res;

        res = await !this.#cloudFlare.getZones();
        if ( !res.ok ) return;

        var zone;

        for ( const row of res.data ) {
            if ( domain === row.name || domain.endsWith( `.${row.name}` ) ) {
                zone = row;

                break;
            }
        }

        // zone not found
        if ( !zone ) return;

        res = await !this.#cloudFlare.getDnsRecords( zone.id );

        for ( const record of res.data ) {
            if ( record.name !== dnsTxtRecordName ) continue;

            res = await !this.#cloudFlare.deleteDnsRecord( zone.id, record.id );

            return;
        }
    }
}
