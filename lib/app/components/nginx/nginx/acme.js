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
import sql from "#lib/sql";
import fs from "node:fs";

const LOCATION = "/.well-known/acme-challenge/";

const SQL = {
    "getAcmeAccount": sql`SELECT url, key FROM nginx_acme_account WHERE email = ? AND test = ?`,

    "getChallenge": sql`SELECT content FROM nginx_acme_challenge WHERE id = ? AND created > ?`.prepare(),
};

env.loadUserEnv();

export default class {
    #nginx;
    #acme;
    #cloudFlareApi;
    #mutexes = new Mutex.Set();
    #cetrificatesRenewInterval;
    #dataDir;
    #accountPath;

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

        this.#cetrificatesRenewInterval = new Interval( this.#nginx.config.cetrificatesRenewInterval );

        this.#dataDir = this.#dataDir = this.#nginx.dataDir + "/acme";

        this.#accountPath = this.#dataDir + `/account-${ this.#nginx.config.acmeEmail }${ this.#nginx.config.acmeTest ? ".test" : ".production" }.json`;
    }

    get location () {
        return LOCATION;
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get app () {
        return this.#nginx.app;
    }

    get dbh () {
        return this.app.dbh;
    }

    // public
    async init () {
        if ( this.app.privateHttpServer ) {
            this.app.privateHttpServer.get( LOCATION + "*", this.#downloadAcmeChallenge.bind( this ) );

            this.app.privateHttpServer.head( LOCATION + "test", this.#testAcmeChallenge.bind( this ) );
        }

        const mutex = this.#getMutex( "init-acme" );

        const locked = await mutex.tryLock();

        if ( !locked ) return mutex.wait();

        var res;

        try {

            // get accpint key from storate
            res = await this.#getAcmeAccount();
            if ( !res.ok ) return res;

            if ( res.data ) {
                var acmeAccount = res.data;
            }

            this.#acme = new Acme( {
                "provider": "letsencrypt",
                "email": this.#nginx.config.acmeEmail,
                "test": this.#nginx.config.acmeTest,
                "accountKey": acmeAccount?.accountKey,
                "accountUrl": acmeAccount?.accountUrl,
            } );

            // create acme account
            res = await this.#acme.createAccount();
            if ( !res.ok ) throw res;

            // store account key
            if ( !acmeAccount ) {
                res = await this.#storeAcmeAccount(
                    this.#acme.accountUrl,
                    crypto.createPrivateKey( this.#acme.accountKey ).export( {
                        "type": "pkcs8",
                        "format": "der",
                    } )
                );

                if ( !res.ok ) throw res;
            }

            res = result( 200 );
        }
        catch ( e ) {}

        await mutex.unlock( res );

        return res;
    }

    async getCertificate ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [ domains ];

        var id;

        if ( domains.length === 1 ) {
            id = domains[ 0 ];
        }
        else {
            id = crypto.createHash( "md5" ).update( JSON.stringify( domains.sort() ) ).digest( "hex" );
        }

        const certificatePath = path.posix.join( this.nginx.config.storageLocation, "certificates", `${ id }.crt.pem` ),
            privateKeyPath = path.posix.join( this.nginx.config.storageLocation, "certificates", `${ id }.key.pem` );

        const mutex = this.#getMutex( "get-certificate/" + id );

        await mutex.lock();

        var res;

        try {

            // get stored certificate
            res = await this.#getStoredCertificate( {
                certificatePath,
                privateKeyPath,
                "checkRenewInterval": true,
            } );

            // stored certificate is valid
            if ( res.ok ) throw res;

            // get certificate
            res = await this.#acme.getCertificate( {
                domains,
                "checkDomain": this.#checkDomain.bind( this ),
                "createChallenge": this.#createChallenge.bind( this ),
                "deleteChallenge": this.#deleteChallenge.bind( this ),
            } );

            if ( res.ok ) {
                console.info( `Nginx updated certificates for domains: ${ domains }` );
            }
            else {
                throw res;
            }

            // upload certificate
            res = await this.#uploadCertificate( {
                "certificate": res.data.certificate,
                certificatePath,
                "privateKey": res.data.privateKey,
                privateKeyPath,
                "expires": res.data.expires,
            } );
            if ( !res.ok ) throw res;

            // get stored certificate
            res = await this.#getStoredCertificate( {
                certificatePath,
                privateKeyPath,
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
            const url = "http://" + domain + LOCATION + "test",
                hostHash = this.#getHostHash( domain );

            let attempts = 3;

            TEST: while ( attempts ) {
                const res = await fetch( url, {
                    "method": "head",
                } );

                if ( res.ok ) {
                    if ( res.headers.get( "x-acme-test" ) === hostHash ) {
                        return true;
                    }
                    else {
                        break TEST;
                    }
                }

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
            const res = await this.dbh.do( sql`INSERT INTO nginx_acme_challenge ( id, content ) VALUES ( ?, ? )`, [

                //
                token,
                content,
            ] );

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
            await this.dbh.do( sql`DELETE FROM nginx_acme_challenge WHERE id = ?`, [ token ] );
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

    // XXX
    async #getStoredCertificate ( { certificatePath, privateKeyPath, checkRenewInterval } ) {
        const certificate = await this.app.storage.getFile( certificatePath );

        // certificate not found
        if ( !certificate.ok ) return certificate;

        const x509Certificate = new crypto.X509Certificate( await certificate.data.buffer() ),
            expires = new Date( x509Certificate.validTo );

        if ( checkRenewInterval ) {

            // renew is required
            if ( this.#cetrificatesRenewInterval.toDate() >= expires ) return result( 404 );
        }

        const privateKey = await this.app.storage.getFile( privateKeyPath );
        if ( !privateKey.ok ) return privateKey;

        return result( 200, {
            "certificate": certificate.data,
            "privateKey": privateKey.data,
            "fingerprint": x509Certificate.fingerprint512,
            expires,
        } );
    }

    // XXX
    async #uploadCertificate ( { certificate, certificatePath, privateKey, privateKeyPath, expires } ) {
        var res;

        res = await await this.app.storage.uploadFile(
            certificatePath,
            new File( {
                "buffer": certificate,
            } ),
            {
                expires,
            }
        );
        if ( !res.ok ) return res;

        res = await await this.app.storage.uploadFile(
            privateKeyPath,
            new File( {
                "buffer": privateKey,
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

        if ( this.app.cluster ) {
            return this.app.cluster.mutexes.get( id );
        }
        else {
            return this.#mutexes.get( id );
        }
    }

    async #getDomainZone ( domain ) {
        const res = await this.#cloudFlareApi.getZones();
        if ( !res.ok ) return;

        for ( const zone of res.data ) {
            if ( domain === zone.name || domain.endsWith( `.${ zone.name }` ) ) {
                return result( 200, zone );
            }
        }

        return result( [ 404, `Domain zone not found` ] );
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

    #getHostHash ( host ) {
        return crypto.createHmac( "sha256", this.#acme.accountKey ).update( host ).digest( "base64url" );
    }

    async #downloadAcmeChallenge ( req ) {
        const id = req.path.substring( LOCATION.length );

        const res = await this.dbh.selectRow( SQL.getChallenge, [

            //
            id,
            new Interval( this.#nginx.config.acmeChallengeMaxAge, { "negative": true } ).toSate(),
        ] );

        if ( !res.ok ) return req.end( res );

        if ( !res.data ) return req.end( 404 );

        return req.end( {
            "status": 200,
            "headers": {
                "cache-control": "no-cache",
            },
            "body": res.data.content,
        } );
    }

    async #testAcmeChallenge ( req ) {
        const host = req.headers.get( "host" );

        if ( !host ) {
            return req.end( 400 );
        }
        else {
            return req.end( {
                "status": 200,
                "headers": {
                    "x-acme-test": this.#getHostHash( host ),
                },
            } );
        }
    }

    async #getAcmeAccount () {
        var account;

        if ( this.#nginx.config.acmeuseFiles ) {
            if ( fs.existsSync( this.#accountPath ) ) {
                account = JSON.parse( fs.readFileSync( this.#accountPath ) );
            }
        }
        else {
            const res = await this.dbh.selectRow( SQL.getAcmeAccount, [

                //
                this.#nginx.config.acmeEmail,
                this.#nginx.config.acmeTest,
            ] );

            if ( !res.ok ) return res;

            account = {
                "accountUrl": res.data.url,
                "accountKey": res.data.key,
            };
        }

        if ( account?.kaccountKey ) {
            account.kaccountKey = this.app.crypto.decrypt( account.kaccountKey, { "encoding": "base64url" } );
        }

        return result( 200, account );
    }

    async #storeAcmeAccount ( accountUrl, accountKey ) {
        accountKey = this.app.crypto.encrypt( accountKey ).toString( "base64url" );

        if ( this.#nginx.config.acmeuseFiles ) {
            fs.mkdirSync( path.dirname( this.#accountPath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                this.#accountPath,
                JSON.stringify( {
                    accountUrl,
                    accountKey,
                } )
            );
        }
        else {
            const res = await this.dbh.do(
                sql`
INSERT INTO
    nginx_acme_account
( email, test, url, key )
VALUES ( ?, ?, ?, ? )
ON CONFLICT ( email, test ) DO UPDATE SET
    url = EXCLUDED.url,
    key = EXCLUDED.key
`,
                [

                    //
                    this.#nginx.config.acmeEmail,
                    this.#nginx.config.acmeTest,
                    accountUrl,
                    accountKey,
                ]
            );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
