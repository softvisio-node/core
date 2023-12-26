import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";
import File from "#lib/file";
import path from "node:path";
import Interval from "#lib/interval";

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

            console.log( `Nginx ACME error:`, e + "" );
        }

        await mutex.unlock();
    }

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, token, content } ) {
        var res;

        // http
        if ( type === "http-01" ) {
            res = await await this.#nginx.app.storage.uploadFile( token, new File( { "buffer": content } ), {
                "cwd": this.#nginx.acmeChallengesLocation,
            } );

            return res.ok;
        }

        // dns
        else if ( type === "dns-01" ) {
            if ( !this.#cloudFlareApi ) return false;

            // get zone
            res = await this.#getDomainZone( domain );
            if ( !res.ok ) return false;

            const zone = res.data;

            // delete record, if exists
            await this.#deleteDnsRecord( dnsTxtRecordName, zone );

            // create record
            res = await this.#cloudFlareApi.createDnsRecord( zone.id, {
                "type": "TXT",
                "name": dnsTxtRecordName,
                content,
                "ttl": 60,
            } );

            return res.ok;
        }

        // not supported
        else {
            return false;
        }
    }

    async #deleteChallenge ( { type, domain, dnsTxtRecordName, token, httpLocation } ) {

        // http
        if ( type === "http-01" ) {
            await this.#nginx.app.storage.deleteFile( token, {
                "cwd": this.#nginx.acmeChallengesLocation,
            } );
        }

        // dns
        else if ( type === "dns-01" ) {
            if ( !this.#cloudFlareApi ) return;

            var res;

            // get zone
            res = await this.#getDomainZone( domain );
            if ( !res.ok ) return;

            const zone = res.data;

            await this.#deleteDnsRecord( dnsTxtRecordName, zone );
        }

        // not supported
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

    async #getDomainZone ( domain ) {
        const res = await this.#cloudFlareApi.getZones();
        if ( !res.ok ) return;

        for ( const zone of res.data ) {
            if ( domain === zone.name || domain.endsWith( `.${zone.name}` ) ) {
                return result( 200, zone );
            }
        }

        return result( [404, `Domain zone not found`] );
    }

    async #deleteDnsRecord ( dnsTxtRecordName, zone ) {
        var res;

        // get records
        res = await this.#cloudFlareApi.getDnsRecords( zone.id );
        if ( !res.ok ) return;

        // delete record
        for ( const record of res.data ) {
            if ( record.type !== "TXT" ) continue;

            if ( record.name !== dnsTxtRecordName ) continue;

            res = await this.#cloudFlareApi.deleteDnsRecord( zone.id, record.id );

            return;
        }
    }
}
