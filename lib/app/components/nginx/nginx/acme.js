import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import fs from "node:fs";
import crypto from "node:crypto";
import File from "#lib/file";
import path from "node:path";

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #cloudFlare;
    #accountKey;
    #mutexes = new Mutex.Set();

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
            certificatePath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.crt` ),
            keyPath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.key` );

        var res;

        res = await this.#getStoredCert( {
            certificatePath,
            keyPath,
        } );
        if ( res.ok ) return res;

        res = await this.#acme.getCertificate( {
            domains,
            "createChallenge": this.#createChallenge.bind( this ),
            "deleteChallenge": this.#deleteChallenge.bind( this ),
        } );

        // XXX
        await this.#storeAccountKey( this.#acme.accountKey );

        if ( !res.ok ) return res;

        await this.#uploadCertificate( {
            "certificate": res.data.certificate,
            certificatePath,
            "key": res.data.key,
            keyPath,
        } );
        if ( !res.ok ) return res;

        return this.#getStoredCert( {
            certificatePath,
            keyPath,
        } );
    }

    // private
    async #createAcme () {
        this.#acme = null;

        if ( !this.#nginx.config.acme?.email ) return;

        if ( !this.#cloudFlare ) return;

        const mutex = this.#getMutex( "create-acme" );

        await mutex.lock();

        this.#acme = new Acme( {
            "provider": "letsencrypt",
            "test": false,
            "email": this.#nginx.config.acme?.email,
            "accountKey": await this.#getAccountKey(),
        } );

        await mutex.unlock();
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

    async #getStoredCert ( { certificatePath, keyPath } ) {
        const certificate = await this.#nginx.app.storage.getFile( certificatePath );
        if ( !certificate.ok ) return certificate;

        const key = await this.#nginx.app.storage.getFile( keyPath );
        if ( !key.ok ) return key;

        return result( 200, {
            "certificate": certificate.data.file,
            "key": key.data.file,
        } );
    }

    async #uploadCertificate ( { certificate, certificatePath, key, keyPath } ) {
        var res;

        res = await await this.#nginx.app.storage.uploadFile(
            new File( {
                "buffer": certificate,
            } ),
            certificatePath,
            {
                "maxAge": this.$nginx.config.certificatesMaxAge,
            }
        );
        if ( !res.ok ) return res;

        res = await await this.#nginx.app.storage.uploadFile(
            new File( {
                "buffer": key,
            } ),
            keyPath,
            {
                "maxAge": this.$nginx.config.certificatesMaxAge,
            }
        );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    #getMutex ( id ) {
        id = "/nginx/" + id;

        if ( this.#nginx.app.cluster ) {
            return this.#nginx.app.cluster.mutexes.get( id );
        }
        else {
            return this.#mutexes.get( id );
        }
    }
}
