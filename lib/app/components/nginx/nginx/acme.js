import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";
import File from "#lib/file";
import path from "node:path";
import Interval from "#lib/interval";
import { sleep } from "#lib/utils";
import fetch from "#lib/fetch";

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #acmeAccountKeyHash;
    #cloudFlareApi;
    #mutexes = new Mutex.Set();
    #acmeAccountKeyPath;
    #cetrificatesRenewInterval;

    constructor ( nginx ) {
        this.#nginx = nginx;

        if ( this.#nginx.config.cloudFlareApiToken ) {
            this.#cloudFlareApi = new CloudFlare( this.#nginx.config.cloudFlareApiToken );
        }
        else if ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL ) {
            this.#cloudFlareApi = new CloudFlare( process.env.CLOUDFLARE_KEY, process.env.CLOUDFLARE_EMAIL );
        }
        else if ( process.env.CLOUDFLARE_TOKEN ) {
            this.#cloudFlareApi = new CloudFlare( process.env.CLOUDFLARE_TOKEN );
        }

        this.#acmeAccountKeyPath = path.posix.join( this.#nginx.config.storageLocation, "acme-account.key.pem" );

        this.#cetrificatesRenewInterval = new Interval( this.#nginx.config.cetrificatesRenewInterval );
    }

    // properties
    get acmeAccountKeyHash () {
        return this.#acmeAccountKeyHash;
    }

    // public
    async init () {
        const mutex = this.#getMutex( "init-acme" );

        const locked = await mutex.tryLock();

        if ( !locked ) return mutex.wait();

        var res;

        try {

            // get accpint key from storate
            res = await this.#nginx.app.storage.getBuffer( this.#acmeAccountKeyPath );
            if ( res.ok ) {
                var accountKey = await res.data;
            }

            this.#acme = new Acme( {
                "provider": "letsencrypt",
                "test": false,
                "email": this.#nginx.config.acmeEmail,
                accountKey,
            } );

            // create acme account
            res = await this.#acme.createAccount();
            if ( !res.ok ) throw res;

            // store account key
            if ( !accountKey ) {
                res = await this.#nginx.app.storage.uploadFile(
                    this.#acmeAccountKeyPath,
                    new File( {
                        "buffer": this.#acme.accountKey,
                    } )
                );

                if ( !res.ok ) throw res;
            }

            this.#acmeAccountKeyHash = crypto.createHash( "md5" ).update( this.#acme.accountKey ).digest( "base64url" );

            res = result( 200 );
        }
        catch ( e ) {}

        await mutex.unlock( res );

        return res;
    }

    async getCertificate ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [domains];

        var id;

        if ( domains.length === 1 ) {
            id = domains[0];
        }
        else {
            id = crypto.createHash( "md5" ).update( JSON.stringify( domains.sort() ) ).digest( "hex" );
        }

        const certificatePath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.crt.pem` ),
            keyPath = path.posix.join( this.#nginx.config.storageLocation, "certificates", `${id}.key.pem` );

        const mutex = this.#getMutex( "get-certificate/" + id );

        await mutex.lock();

        var res;

        try {
            res = await this.#getStoredCertificate( {
                certificatePath,
                keyPath,
                "checkRenewInterval": true,
            } );
            if ( res.ok ) throw res;

            res = await this.#acme.getCertificate( {
                domains,
                "checkDomain": this.#checkDomain.bind( this ),
                "createChallenge": this.#createChallenge.bind( this ),
                "deleteChallenge": this.#deleteChallenge.bind( this ),
            } );
            if ( !res.ok ) throw res;

            res = await this.#uploadCertificate( {
                "certificate": res.data.certificate,
                certificatePath,
                "key": res.data.key,
                keyPath,
                "expires": res.data.expires,
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

    canGetCertificate ( serverName ) {
        return Acme.canGetCertificate( serverName );
    }

    // private
    async #checkDomain ( { name, isWildcard, domain, dnsTxtRecordName, resolved } ) {

        // check http
        if ( resolved ) {
            const url = "http://" + domain + `/.well-known/acme-challenge/test`;

            let attempts = 3;

            while ( attempts ) {
                const res = await fetch( url, {
                    "method": "head",
                } );

                if ( res.ok && res.headers.get( "x-acme-test" ) === this.acmeAccountKeyHash ) return true;

                await sleep( 3000 );

                attempts--;
            }
        }

        // check dns
        if ( this.#cloudFlareApi ) {

            // get zone
            const res = await this.#getDomainZone( domain );

            // domains zone found
            if ( res.ok ) return true;
        }

        return false;
    }

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, token, content } ) {
        var res;

        // http
        if ( type === "http-01" ) {
            res = await await this.#nginx.app.storage.uploadFile( token, new File( { "buffer": content } ), {
                "cwd": this.#nginx.acmeChallengesStorageLocation,
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
                "cwd": this.#nginx.acmeChallengesStorageLocation,
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

    async #getStoredCertificate ( { certificatePath, keyPath, checkRenewInterval } ) {
        const certificate = await this.#nginx.app.storage.getFile( certificatePath );
        if ( !certificate.ok ) return certificate;

        const certificateBuffer = await certificate.data.buffer();

        if ( checkRenewInterval ) {
            const certificateData = new crypto.X509Certificate( certificateBuffer );

            const expires = new Date( certificateData.validTo );

            // renew is required
            if ( this.#cetrificatesRenewInterval.toDate() >= expires ) return result( 404 );
        }

        const key = await this.#nginx.app.storage.getFile( keyPath );
        if ( !key.ok ) return key;

        const hash = crypto
            .createHash( "md5" )
            .update( certificateBuffer )
            .update( await key.data.buffer() )
            .digest( "hex" );

        return result( 200, {
            hash,
            "certificate": certificate.data,
            "key": key.data,
        } );
    }

    async #uploadCertificate ( { certificate, certificatePath, key, keyPath, expires } ) {
        var res;

        res = await await this.#nginx.app.storage.uploadFile(
            certificatePath,
            new File( {
                "buffer": certificate,
            } ),
            {
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
