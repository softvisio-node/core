import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import fs from "node:fs";
import crypto from "node:crypto";
import File from "#lib/file";

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

        if ( !this.#nginx.app.storage ) return result( [400, `Storage is required to use SSL`] );

        const id = crypto.createHash( "md5" ).update( JSON.stringify( domains.sort() ) ).digest( "hex" ),
            certPath = `/nginx/certificates/${id}.cert`,
            keyPath = `/nginx/certificates/${id}.key`;

        var res;

        res = await this.#getStoredCert( id );
        if ( res.ok ) return res;

        res = await this.#acme.getCertificate( {
            domains,
            "createChallenge": this.#createChallenge.bind( this ),
            "deleteChallenge": this.#deleteChallenge.bind( this ),
        } );

        await this.#storeAccountKey( this.#acme.accountKey );

        if ( !res.ok ) return res;

        await await this.#nginx.app.storage.uploadFile(
            new File( {
                "buffer": res.data.certificate,
            } ),
            certPath,
            {
                "maxAge": this.$nginx.config.certificatesMaxAge,
            }
        );

        await await this.#nginx.app.storage.uploadFile(
            new File( {
                "buffer": res.data.path,
            } ),
            keyPath,
            {
                "maxAge": this.$nginx.config.certificatesMaxAge,
            }
        );

        return this.#getStoredCert( id );
    }

    // private
    async #createAcme () {
        this.#acme = null;

        if ( !this.#nginx.config.acme?.email ) return;

        if ( !this.#cloudFlare ) return;

        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        this.#acme = new Acme( {
            "provider": "letsencrypt",
            "test": false,
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

        await this.#deleteChallenge( { type, domain, dnsTxtRecordName, httpLocation } );

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

    async #getStoredCert ( id ) {
        const certPath = `/nginx/certificates/${id}.cert`,
            keyPath = `/nginx/certificates/${id}.key`;

        const certificate = await this.#nginx.app.storage.getFile( certPath );
        if ( !certificate.ok ) return certificate;

        const key = await this.#nginx.app.storage.getFile( keyPath );
        if ( !key.ok ) return key;

        return result( 200, {
            "certificate": certificate.data.file,
            "key": key.data.file,
        } );
    }

    async #uploadCertificate () {}
}
