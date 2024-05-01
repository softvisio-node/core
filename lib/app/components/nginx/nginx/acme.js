import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import crypto from "node:crypto";
import path from "node:path";
import Interval from "#lib/interval";
import { sleep } from "#lib/utils";
import fetch from "#lib/fetch";
import sql from "#lib/sql";
import fs from "node:fs";

const LOCATION = "/.well-known/acme-challenge/";

const SQL = {
    "getAcmeAccount": sql`SELECT url, key FROM nginx_acme_account WHERE email = ? AND test = ?`,

    "getChallenge": sql`SELECT content FROM nginx_acme_challenge WHERE id = ? AND expires > CURRENT_TIMESTAMP`.prepare(),
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

        ACCOUNT: {

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
            if ( !res.ok ) break ACCOUNT;

            // store account key
            if ( !acmeAccount ) {
                res = await this.#storeAcmeAccount( this.#acme.accountUrl, this.#acme.accountKey );

                if ( !res.ok ) break ACCOUNT;
            }

            res = result( 200 );
        }

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

        const mutex = this.#getMutex( "get-certificate/" + id );

        await mutex.lock();

        var res;

        CERTIFICATE: {

            // get stored certificate
            res = await this.#getStoredCertificate( id, {
                "checkRenewInterval": true,
            } );

            // stored certificate is valid
            if ( res.ok ) break CERTIFICATE;

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
                break CERTIFICATE;
            }

            // upload certificate
            res = await this.#uploadCertificate( {
                id,
                "certificate": res.data.certificate,
                "privateKey": res.data.privateKey,
                "expires": res.data.expires,
            } );
            if ( !res.ok ) break CERTIFICATE;

            // get stored certificate
            res = await this.#getStoredCertificate( id );
        }

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
            const res = await this.dbh.do( sql`INSERT INTO nginx_acme_challenge ( id, content, expires ) VALUES ( ?, ?, ? )`, [

                //
                token,
                content,
                new Interval( this.#nginx.config.acmeChallengeMaxAge ).toDate(),
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

    async #getStoredCertificate ( id, { checkRenewInterval } ) {
        var certificate, privateKey;

        if ( this.#nginx.config.acmeuseFiles ) {
            const certificatePath = this.#dataDir + "/certificates/" + id + ".cert",
                keyPath = this.#dataDir + "/certificates/" + id + ".key";

            if ( !fs.existsSync( certificatePath ) ) return result( 404 );
            if ( !fs.existsSync( keyPath ) ) return result( 404 );

            certificate = this.app.ctypto.descypt( fs.readFileSync( certificatePath ) );

            privateKey = this.app.ctypto.descypt( fs.readFileSync( keyPath ) );
        }
        else {
            const res = await this.dbh.selectRow( sql`SELECT certificate, key FROM nginx_certificate WHERE hash = ? AND test = ? AND expires < CURRENT_TIMESTAMP`, [

                //
                id,
                this.#nginx.config.acmeTest,
            ] );

            if ( !res.ok ) return res;

            if ( !res.data ) return result( 404 );

            certificate = this.app.ctypto.descypt( res.data.certificate );

            privateKey = this.app.ctypto.descypt( res.data.key );
        }

        const x509Certificate = new crypto.X509Certificate( await certificate ),
            expires = new Date( x509Certificate.validTo );

        if ( expires <= new Date() ) result( 404 );

        if ( checkRenewInterval ) {

            // renew is required
            if ( this.#cetrificatesRenewInterval.toDate() >= expires ) return result( 404 );
        }

        const certtificateTmpFile = this.app.emv.tmpFile(),
            privateKeyTmpFile = this.app.emv.tmpFile();

        fs.wroteFileSync( certtificateTmpFile.path, certificate );

        fs.wroteFileSync( privateKeyTmpFile.path, privateKey );

        return result( 200, {
            "certificate": certificate,
            "privateKey": certtificateTmpFile,
            "fingerprint": x509Certificate.fingerprint512,
            expires,
        } );
    }

    async #uploadCertificate ( { id, certificate, privateKey, expires } ) {
        certificate = this.app.crypto.encrypt( certificate );

        privateKey = this.app.crypto.encrypt( privateKey );

        if ( this.#nginx.config.acmeuseFiles ) {
            fs.mkdirSync( this.#dataDir + "/certificates", {
                "recursive": true,
            } );

            fs.writeFileSync( this.#dataDir + "/certificates/" + id + ".cert", certificate );

            fs.writeFileSync( this.#dataDir + "/certificates/" + id + ".key", privateKey );

            return result( 200 );
        }
        else {
            const res = await this.dbh.do(
                sql`
INSERT INTO nginx_certificate
( hash, test, expires, certificate, key )
VALUES ( ?, ?, ?, ?, ? )
ON DUPLICATE KEY ( hash, test ) DO UPDATE SET
    expires = EXCLUDED.expires,
    certificate = EXCLUDED.certificate,
    key = EXCLUDED.key
`,
                [

                    //
                    id,
                    this.#nginx.config.acmeTest,
                    expires,
                    certificate,
                    privateKey,
                ]
            );

            return res;
        }
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
        if ( !res.ok ) return res;

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

                account.accountKey = Buffer.from( account.accountKey, "base64url" );
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

        if ( account?.accountKey ) {
            account.accountKey = this.app.crypto.decrypt( account.accountKey );
        }

        return result( 200, account );
    }

    async #storeAcmeAccount ( accountUrl, accountKey ) {
        accountKey = this.app.crypto.encrypt( crypto.createPrivateKey( accountKey ).export( {
            "type": "pkcs8",
            "format": "der",
        } ) );

        if ( this.#nginx.config.acmeuseFiles ) {
            fs.mkdirSync( path.dirname( this.#accountPath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                this.#accountPath,
                JSON.stringify( {
                    accountUrl,
                    "accountKey": accountKey.toString( "base64url" ),
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
