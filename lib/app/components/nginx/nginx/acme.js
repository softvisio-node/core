import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import Mutex from "#lib/threads/mutex";
import path from "node:path";
import Interval from "#lib/interval";
import { sleep } from "#lib/utils";
import fetch from "#lib/fetch";
import sql from "#lib/sql";
import fs from "node:fs";
import crypto from "node:crypto";

const LOCATION = "/.well-known/acme-challenge/";

const SQL = {
    "getAcmeAccount": sql`SELECT url, key FROM nginx_acme_account WHERE email = ? AND test = ?`,

    "upsertAccount": sql`
INSERT INTO nginx_acme_account
    ( email, test, url, key )
VALUES
    ( ?, ?, ?, ? )
ON CONFLICT ( email, test ) DO UPDATE SET
    url = EXCLUDED.url,
    key = EXCLUDED.key
`,

    "getCertificate": sql`SELECT certificate, key FROM nginx_certificate WHERE domains = ? AND test = ? AND expires > CURRENT_TIMESTAMP`,

    "upsertCertificate": sql`
INSERT INTO nginx_certificate
    ( domains, test, expires, certificate, key )
VALUES
    ( ?, ?, ?, ?, ? )
ON CONFLICT ( domains, test ) DO UPDATE SET
    expires = EXCLUDED.expires,
    certificate = EXCLUDED.certificate,
    key = EXCLUDED.key
`,

    "getChallenge": sql`SELECT content FROM nginx_acme_challenge WHERE id = ? AND expires > CURRENT_TIMESTAMP`.prepare(),

    "insertChallenge": sql`INSERT INTO nginx_acme_challenge ( id, content, expires ) VALUES ( ?, ?, ? )`,

    "deleteChallenge": sql`DELETE FROM nginx_acme_challenge WHERE id = ?`,
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
    #challenges = {};

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

        this.#dataDir = this.#dataDir = this.#nginx.dataDir + "/acme/" + ( this.#nginx.config.acmeTest ? "test" : "production" );

        this.#accountPath = this.#dataDir + `/accounts/${ this.#nginx.config.acmeEmail }.json`;
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

        domains = domains.sort();

        const id = domains.join( "," );

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
            if ( this.dbh ) {
                const res = await this.dbh.do( SQL.insertChallenge, [

                    //
                    token,
                    content,
                    new Interval( this.#nginx.config.acmeChallengeMaxAge ).toDate(),
                ] );

                return res.ok;
            }
            else {
                this.#challenges[ token ] = content;

                return true;
            }
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
            if ( this.dbh ) {
                await this.dbh.do( SQL.deleteChallenge, [ token ] );
            }
            else {
                delete this.#challenges[ token ];
            }
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

    async #getStoredCertificate ( id, { checkRenewInterval } = {} ) {
        var certificate, privateKey;

        if ( this.#nginx.config.acmeuseLocalFilesStorage ) {
            const certificatePath = this.#createCertificatePath( id );

            if ( !fs.existsSync( certificatePath ) ) return result( 404 );

            ( { certificate, privateKey } = JSON.parse( fs.readFileSync( certificatePath ) ) );

            certificate = this.app.crypto.decrypt( certificate, { "encoding": "base64url" } );

            privateKey = this.app.crypto.decrypt( privateKey, { "encoding": "base64url" } );
        }
        else {
            const res = await this.dbh.selectRow( SQL.getCertificate, [

                //
                id,
                this.#nginx.config.acmeTest,
            ] );

            if ( !res.ok ) return res;

            if ( !res.data ) return result( 404 );

            certificate = this.app.crypto.decrypt( res.data.certificate );

            privateKey = this.app.crypto.decrypt( res.data.key );
        }

        const x509Certificate = new crypto.X509Certificate( await certificate ),
            expires = new Date( x509Certificate.validTo );

        if ( expires <= new Date() ) result( 404 );

        if ( checkRenewInterval ) {

            // renew is required
            if ( this.#cetrificatesRenewInterval.toDate() >= expires ) return result( 404 );
        }

        const certtificateTmpFile = new this.app.env.TmpFile(),
            privateKeyTmpFile = new this.app.env.TmpFile();

        fs.writeFileSync( certtificateTmpFile.path, certificate );

        fs.writeFileSync( privateKeyTmpFile.path, privateKey );

        return result( 200, {
            "certificate": certtificateTmpFile,
            "privateKey": privateKeyTmpFile,
            "fingerprint": x509Certificate.fingerprint512,
            expires,
        } );
    }

    async #uploadCertificate ( { id, certificate, privateKey, expires } ) {
        certificate = this.app.crypto.encrypt( certificate );

        privateKey = this.app.crypto.encrypt( privateKey );

        if ( this.#nginx.config.acmeuseLocalFilesStorage ) {
            const certificatePath = this.#createCertificatePath( id );

            fs.mkdirSync( path.dirname( certificatePath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                certificatePath,
                JSON.stringify( {
                    id,
                    "test": this.#nginx.config.acmeTest,
                    expires,
                    "certificate": certificate.toString( "base64url" ),
                    "privateKey": privateKey.toString( "base64url" ),
                } )
            );

            return result( 200 );
        }
        else {
            return this.dbh.do( SQL.upsertCertificate, [

                //
                id,
                this.#nginx.config.acmeTest,
                expires,
                certificate,
                privateKey,
            ] );
        }
    }

    #createCertificatePath ( id ) {
        return this.#dataDir + "/certificates/" + id.replaceAll( "*", "" ) + ".json";
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

        var challenge;

        if ( this.app.dbh ) {
            const res = await this.dbh.selectRow( SQL.getChallenge, [

                //
                id,
            ] );

            if ( !res.ok ) return req.end( res );

            challenge = res.data?.content;
        }
        else {
            challenge = this.#challenges[ id ];
        }

        if ( !challenge ) return req.end( 404 );

        return req.end( {
            "status": 200,
            "headers": {
                "cache-control": "no-cache",
            },
            "body": challenge,
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

        if ( this.#nginx.config.acmeuseLocalFilesStorage ) {
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

            if ( res.data ) {
                account = {
                    "accountUrl": res.data.url,
                    "accountKey": res.data.key,
                };
            }
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

        if ( this.#nginx.config.acmeuseLocalFilesStorage ) {
            fs.mkdirSync( path.dirname( this.#accountPath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                this.#accountPath,
                JSON.stringify( {
                    "email": this.#nginx.config.acmeEmail,
                    "test": this.#nginx.config.acmeTest,
                    accountUrl,
                    "accountKey": accountKey.toString( "base64url" ),
                } )
            );
        }
        else {
            const res = await this.dbh.do( SQL.upsertAccount, [

                //
                this.#nginx.config.acmeEmail,
                this.#nginx.config.acmeTest,
                accountUrl,
                accountKey,
            ] );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
