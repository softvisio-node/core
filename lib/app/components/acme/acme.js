import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Acme from "#lib/api/acme";
import CloudFlare from "#lib/api/cloudflare";
import env from "#lib/env";
import fetch from "#lib/fetch";
import Interval from "#lib/interval";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";
import { sleep } from "#lib/utils";

const LOCATION = "/.well-known/acme-challenge/";

const SQL = {
    "getAcmeAccount": sql`SELECT url, key FROM acme_account WHERE email = ? AND test = ?`,

    "upsertAccount": sql`
INSERT INTO acme_account
    ( email, test, url, key )
VALUES
    ( ?, ?, ?, ? )
ON CONFLICT ( email, test ) DO UPDATE SET
    url = EXCLUDED.url,
    key = EXCLUDED.key
`,

    "getCertificate": sql`SELECT certificate, key FROM acme_certificate WHERE domains = ? AND test = ? AND expires > CURRENT_TIMESTAMP`,

    "upsertCertificate": sql`
INSERT INTO acme_certificate
    ( domains, test, expires, certificate, key )
VALUES
    ( ?, ?, ?, ?, ? )
ON CONFLICT ( domains, test ) DO UPDATE SET
    expires = EXCLUDED.expires,
    certificate = EXCLUDED.certificate,
    key = EXCLUDED.key
`,

    "getChallenge": sql`SELECT content FROM acme_challenge WHERE id = ? AND expires > CURRENT_TIMESTAMP`.prepare(),

    "insertChallenge": sql`INSERT INTO acme_challenge ( id, content, expires ) VALUES ( ?, ?, ? )`,

    "deleteChallenge": sql`DELETE FROM acme_challenge WHERE id = ?`,
};

env.loadUserEnv();

export default class {
    #app;
    #config;
    #dataDir;
    #acme;
    #cloudFlareApi;
    #mutexes = new Mutex.Set();
    #cetrificatesRenewInterval;
    #accountPath;
    #challenges = {};

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#cetrificatesRenewInterval = new Interval( this.#config.cetrificatesRenewInterval );

        this.#dataDir = this.#app.env.dataDir + "/acme/" + ( this.#config.test
            ? "test"
            : "production" );

        this.#accountPath = this.#dataDir + `/accounts/${ this.#config.email }.json`;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.app.dbh;
    }

    get location () {
        return LOCATION;
    }

    get useLocalStorage () {
        return this.#config.useLocalStorage;
    }

    get httpEnabled () {
        return this.#config.httpEnabled;
    }

    get dnsEnabled () {
        return this.#config.dnsEnabled;
    }

    // public
    async init () {
        if ( this.useLocalStorage ) {
            console.log( `ACME uses local storage` );
        }
        else {
            console.log( `ACME uses shared storage` );
        }

        // init db
        if ( this.app.dbh ) {
            res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;
        }

        // configure http servers
        if ( this.httpEnabled ) {
            if ( this.app.publicHttpServer ) {
                this.app.publicHttpServer.get( LOCATION + "*", this.#downloadAcmeChallenge.bind( this ) );

                this.app.publicHttpServer.head( LOCATION + "test", this.#testAcmeChallenge.bind( this ) );
            }

            if ( this.app.privateHttpServer ) {
                this.app.privateHttpServer.get( LOCATION + "*", this.#downloadAcmeChallenge.bind( this ) );

                this.app.privateHttpServer.head( LOCATION + "test", this.#testAcmeChallenge.bind( this ) );
            }
        }

        // create CloudFlare API
        if ( this.#config.dnsEnabled ) {
            if ( this.#config.cloudFlareApiToken ) {
                this.#cloudFlareApi = new CloudFlare( this.#config.cloudFlareApiToken );
            }
            else if ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL ) {
                this.#cloudFlareApi = new CloudFlare( process.env.CLOUDFLARE_KEY, process.env.CLOUDFLARE_EMAIL );
            }
            else if ( process.env.CLOUDFLARE_TOKEN ) {
                this.#cloudFlareApi = new CloudFlare( process.env.CLOUDFLARE_TOKEN );
            }
        }

        const mutex = this.#getMutex( "init" ),
            locked = await mutex.tryLock();

        if ( !locked ) return mutex.wait();

        var res;

        ACCOUNT: {

            // get accounnt key from storage
            res = await this.#getAcmeAccount();
            if ( !res.ok ) return res;

            if ( res.data ) {
                var acmeAccount = res.data;
            }

            this.#acme = new Acme( {
                "email": this.#config.email,
                "test": this.#config.test,
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
        if ( resolved && this.httpEnabled ) {
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
            if ( !this.httpEnabled ) return result( 500 );

            if ( this.useLocalStorage ) {
                this.#challenges[ token ] = content;

                return result( 200 );
            }
            else {
                const res = await this.dbh.do( SQL.insertChallenge, [

                    //
                    token,
                    content,
                    new Interval( this.#config.challengeMaxAge ).addDate(),
                ] );

                return res;
            }
        }

        // dns
        else if ( type === "dns-01" ) {
            if ( !this.#cloudFlareApi ) return result( 500 );

            // get zone
            res = await this.#getDomainZone( domain );
            if ( !res.ok ) return res;

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
            if ( !res.ok ) return res;

            return result( 200, {
                "dnsTtl": res.data.ttl,
            } );
        }

        // not supported
        else {
            return result( 500 );
        }
    }

    async #deleteChallenge ( { type, domain, dnsTxtRecordName, token, httpLocation } ) {

        // http
        if ( type === "http-01" ) {
            if ( this.useLocalStorage ) {
                delete this.#challenges[ token ];
            }
            else {
                await this.dbh.do( SQL.deleteChallenge, [ token ] );
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

        if ( this.useLocalStorage ) {
            const certificatePath = this.#createCertificatePath( id );

            if ( !fs.existsSync( certificatePath ) ) return result( 404 );

            ( { certificate, privateKey } = JSON.parse( fs.readFileSync( certificatePath ) ) );

            certificate = await this.app.crypto.decrypt( certificate, { "inputEncoding": "base64url" } );

            privateKey = await this.app.crypto.decrypt( privateKey, { "inputEncoding": "base64url" } );
        }
        else {
            const res = await this.dbh.selectRow( SQL.getCertificate, [

                //
                id,
                this.#config.test,
            ] );

            if ( !res.ok ) return res;

            if ( !res.data ) return result( 404 );

            certificate = await this.app.crypto.decrypt( res.data.certificate );

            privateKey = await this.app.crypto.decrypt( res.data.key );
        }

        const x509Certificate = new crypto.X509Certificate( await certificate ),
            expires = new Date( x509Certificate.validTo );

        if ( expires <= new Date() ) result( 404 );

        if ( checkRenewInterval ) {

            // renew is required
            if ( this.#cetrificatesRenewInterval.addDate() >= expires ) return result( 404 );
        }

        const certtificateTmpFile = new this.app.env.TmpFile(),
            privateKeyTmpFile = new this.app.env.TmpFile();

        fs.writeFileSync( certtificateTmpFile.path, certificate );

        fs.writeFileSync( privateKeyTmpFile.path, privateKey );

        return result( 200, {
            "certificatePath": certtificateTmpFile,
            "privateKeyPath": privateKeyTmpFile,
            "fingerprint": x509Certificate.fingerprint512,
            expires,
        } );
    }

    async #uploadCertificate ( { id, certificate, privateKey, expires } ) {
        certificate = await this.app.crypto.encrypt( certificate );

        privateKey = await this.app.crypto.encrypt( privateKey );

        if ( this.useLocalStorage ) {
            const certificatePath = this.#createCertificatePath( id );

            fs.mkdirSync( path.dirname( certificatePath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                certificatePath,
                JSON.stringify( {
                    "domains": id,
                    "test": this.#config.test,
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
                this.#config.test,
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

        if ( this.useLocalStorage ) {
            return this.#mutexes.get( id );
        }
        else {
            return this.app.cluster.mutexes.get( id );
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
        const id = req.path.slice( LOCATION.length );

        var challenge;

        if ( this.useLocalStorage ) {
            challenge = this.#challenges[ id ];
        }
        else {
            const res = await this.dbh.selectRow( SQL.getChallenge, [

                //
                id,
            ] );

            if ( !res.ok ) return req.end( res );

            challenge = res.data?.content;
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

        if ( this.useLocalStorage ) {
            if ( fs.existsSync( this.#accountPath ) ) {
                account = JSON.parse( fs.readFileSync( this.#accountPath ) );

                account.accountKey = Buffer.from( account.accountKey, "base64url" );
            }
        }
        else {
            const res = await this.dbh.selectRow( SQL.getAcmeAccount, [

                //
                this.#config.email,
                this.#config.test,
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
            account.accountKey = await this.app.crypto.decrypt( account.accountKey );
        }

        return result( 200, account );
    }

    async #storeAcmeAccount ( accountUrl, accountKey ) {
        accountKey = await this.app.crypto.encrypt( crypto.createPrivateKey( accountKey ).export( {
            "type": "pkcs8",
            "format": "der",
        } ) );

        if ( this.useLocalStorage ) {
            fs.mkdirSync( path.dirname( this.#accountPath ), {
                "recursive": true,
            } );

            fs.writeFileSync(
                this.#accountPath,
                JSON.stringify( {
                    "email": this.#config.email,
                    "test": this.#config.test,
                    accountUrl,
                    "accountKey": accountKey.toString( "base64url" ),
                } )
            );
        }
        else {
            const res = await this.dbh.do( SQL.upsertAccount, [

                //
                this.#config.email,
                this.#config.test,
                accountUrl,
                accountKey,
            ] );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
