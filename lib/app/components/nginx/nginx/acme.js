import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import fs from "node:fs";

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #cloudFlare;
    #accountKey;
    #mutex = new Mutex();

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
    async getCertificate ( domains ) {
        if ( this.#acme === undefined ) await this.#createAcme();

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
    async #createAcme () {
        this.#acme = null;

        if ( !this.#nginx.config.acme?.email ) return;

        if ( !this.#cloudFlare ) return;

        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        this.#acme = new Acme( {
            "provider": "letsencrypt",
            "test": true,
            "email": this.#nginx.config.acme?.email,
            "accountKey": await this.#getAccountKey(),
        } );

        this.#mutex.unlock();
    }

    async #getAccountKey () {
        if ( fs.existsSync( this.#nginx.app.env.dataDir + "/nginx/acme-account-key" ) ) {
            this.#accountKey = fs.readFileSync( this.#nginx.app.env.dataDir + "/nginx/acme-account-key" );
        }

        return this.#accountKey;
    }

    async #storeAccountKey ( accountKey ) {
        if ( this.#accountKey === accountKey ) return;

        this.#accountKey = accountKey;

        fs.writeFileSync( this.#nginx.app.env.dataDir + "/nginx/acme-account-key", accountKey );
    }

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, content } ) {
        if ( type !== "dns-01" ) return false;

        if ( !this.#cloudFlare ) return;

        var res;

        res = await this.#cloudFlare.getZones();
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

        res = await this.#cloudFlare.createDnsRecord( zone.id, {
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

        if ( !this.#cloudFlare ) return;

        var res;

        res = await this.#cloudFlare.getZones();
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

        res = await this.#cloudFlare.getDnsRecords( zone.id );

        for ( const record of res.data ) {
            if ( record.name !== dnsTxtRecordName ) continue;

            res = await this.#cloudFlare.deleteDnsRecord( zone.id, record.id );

            return;
        }
    }
}
