import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";
import File from "#lib/file";
import path from "node:path";
import Interval from "#lib/interval";
import fs from "node:fs";

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #cloudFlareApi;
    #mutexes = new Mutex.Set();
    #acmeAccountKeyPath;
    #cetrificatesRenewInterval;

    constructor ( nginx ) {
        this.#nginx = nginx;

        if ( this.#nginx.config.cloudFlareApiToken ) {
            this.#cloudFlareApi = new CloudFlare( this.#nginx.config.cloudFlareApiToken );
        }
        else if ( process.env.CLOUDFLARE_TOKEN && process.env.CLOUDFLARE_EMAIL ) {
            this.#cloudFlareApi = new CloudFlare( process.env.CLOUDFLARE_TOKEN, process.env.CLOUDFLARE_EMAIL );
        }

        this.#acmeAccountKeyPath = path.posix.join( this.#nginx.config.storageLocation, "acme-account.key.pem" );

        this.#cetrificatesRenewInterval = new Interval( this.#nginx.config.cetrificatesRenewInterval );
    }

    // public
    async getCertificate ( domains ) {
        if ( this.#acme == null ) await this.#createAcme();

        if ( !this.#acme ) return result( [400, `ACME not availeble`] );

        const id = crypto.createHash( "md5" ).update( JSON.stringify( domains.sort() ) ).digest( "hex" ),
            certificatePath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.crt.pem` ),
            keyPath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.key.pem` );

        const mutex = this.#getMutex( "get-certificate/" + id );

        await mutex.lock();

        var res;

        try {
            res = await this.#getStoredCertificate( {
                certificatePath,
                keyPath,
                "checkLastModified": true,
            } );
            if ( res.ok ) throw res;

            res = await this.#acme.getCertificate( {
                domains,
                "createChallenge": this.#createChallenge.bind( this ),
                "deleteChallenge": this.#deleteChallenge.bind( this ),
            } );
            if ( !res.ok ) throw res;

            res = await this.#uploadCertificate( {
                "certificate": res.data.certificate,
                certificatePath,
                "key": res.data.key,
                keyPath,
            } );
            if ( !res.ok ) throw res;

            res = await this.#getStoredCertificate( {
                certificatePath,
                keyPath,
            } );
        }
        catch ( e ) {}

        await mutex.unlock();

        return res;
    }

    // private
    async #createAcme () {
        const mutex = this.#getMutex( "create-acme" );

        const locked = await mutex.tryLock();

        if ( !locked ) return mutex.wait();

        var res;

        try {
            if ( !this.#nginx.config.acmeEmail ) throw result( [500, `nginx ACME not configured`] );

            if ( !this.#nginx.app.storage ) throw result( [500, `nginx ACME storage not available`] );

            // get accpint key from storate
            res = await this.#nginx.app.storage.getBuffer( this.#acmeAccountKeyPath );
            if ( res.ok ) {
                var accountKey = await res.data;
            }

            const acme = new Acme( {
                "provider": "letsencrypt",
                "test": false,
                "email": this.#nginx.config.acmeEmail,
                accountKey,
            } );

            // create acme account
            res = await acme.createAccount();
            if ( !res.ok ) throw res;

            // store account key
            if ( !accountKey ) {
                res = await this.#nginx.app.storage.uploadFile(
                    this.#acmeAccountKeyPath,
                    new File( {
                        "buffer": acme.accountKey,
                    } )
                );

                if ( !res.ok ) throw res;
            }

            this.#acme = acme;
        }
        catch ( e ) {
            this.#acme = false;

            console.log( `nginx ACME error:`, e + "" );
        }

        await mutex.unlock();
    }

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, token, content } ) {
        if ( type === "http-01" ) {
            await fs.promises.mkdir( this.#nginx.acmeChallengesDir, { "recursive": true } );

            await fs.promises.writeFile( this.#nginx.acmeChallengesDir + "/" + token, content );

            return true;
        }
        else if ( type === "dns-01" ) {
            if ( !this.#cloudFlareApi ) return;

            var res;

            res = await this.#cloudFlareApi.getZones();
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

            res = await this.#cloudFlareApi.createDnsRecord( zone.id, {
                "type": "TXT",
                "name": dnsTxtRecordName,
                content,
                "ttl": 60,
            } );

            if ( !res.ok ) return;

            return true;
        }
        else {
            return false;
        }
    }

    async #deleteChallenge ( { type, domain, dnsTxtRecordName, token, httpLocation } ) {
        if ( type === "http-01" ) {
            await fs.promises.rm( this.#nginx.acmeChallengesDir + "/" + token, {
                "force": true,
            } );
        }
        else if ( type === "dns-01" ) {
            if ( !this.#cloudFlareApi ) return;

            var res;

            res = await this.#cloudFlareApi.getZones();
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

            res = await this.#cloudFlareApi.getDnsRecords( zone.id );

            for ( const record of res.data ) {
                if ( record.name !== dnsTxtRecordName ) continue;

                res = await this.#cloudFlareApi.deleteDnsRecord( zone.id, record.id );

                return;
            }
        }
        else {
            return;
        }
    }

    async #getStoredCertificate ( { certificatePath, keyPath, checkLastModified } ) {
        if ( checkLastModified ) {
            const meta = await this.#nginx.app.storage.getFileMeta( certificatePath );

            if ( !meta ) return result( 404 );

            // renew is required
            if ( this.#cetrificatesRenewInterval.toDate( meta.lastModified ) < new Date() ) return result( 404 );
        }

        const certificate = await this.#nginx.app.storage.getFile( certificatePath );
        if ( !certificate.ok ) return certificate;

        const key = await this.#nginx.app.storage.getFile( keyPath );
        if ( !key.ok ) return key;

        const hash = crypto
            .createHash( "md5" )
            .update( await certificate.data.buffer() )
            .update( await key.data.buffer() )
            .digest( "hex" );

        return result( 200, {
            hash,
            "certificate": certificate.data,
            "key": key.data,
        } );
    }

    async #uploadCertificate ( { certificate, certificatePath, key, keyPath } ) {
        var res;

        const lastModified = new Date(),
            expires = new Interval( this.#nginx.config.certificatesMaxAge ).toDate( lastModified );

        res = await await this.#nginx.app.storage.uploadFile(
            certificatePath,
            new File( {
                "buffer": certificate,
            } ),
            {
                lastModified,
                expires,
            }
        );
        if ( !res.ok ) return res;

        res = await await this.#nginx.app.storage.uploadFile(
            keyPath,
            new File( {
                "buffer": key,
            } ),
            {
                lastModified,
                expires,
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
