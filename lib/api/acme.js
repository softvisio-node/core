import "#lib/result";
import crypto from "node:crypto";
import fetch from "#lib/fetch";
import { sleep } from "#lib/utils";
import dns from "node:dns";
import Mutex from "#lib/threads/mutex";
import Hostname from "#lib/hostname";
import Counter from "#lib/threads/counter";
import certificates from "#lib/certificates";
import forge from "#lib/forge";

const DIRECTORIES = {
    "buypass": {
        "staging": "https://api.test4.buypass.no/acme/directory",
        "production": "https://api.buypass.com/acme/directory",
    },
    "letsencrypt": {
        "staging": "https://acme-staging-v02.api.letsencrypt.org/directory",
        "production": "https://acme-v02.api.letsencrypt.org/directory",
    },
    "zerossl": {
        "production": "https://acme.zerossl.com/v2/DV90",
    },
};

const STATUSES = {
    "invalid": new Set( ["invalid"] ),
    "pending": new Set( ["pending", "processing"] ),
    "ready": new Set( ["ready", "valid"] ),
};

export default class Acme {
    #directory;
    #email;
    #accountKey;
    #accountUrl;
    #directories;
    #maxBadNonceRetries = 3;
    #jwk;
    #mutex = new Mutex();

    constructor ( { provider, test, email, accountKey, accountUrl } = {} ) {
        this.#email = email;

        if ( accountKey ) {
            if ( !Buffer.isBuffer( accountKey ) ) {
                accountKey = Buffer.from( accountKey );
            }

            this.#accountKey = accountKey;
        }

        this.#accountUrl = accountUrl;

        this.#directory = DIRECTORIES[provider][test ? "staging" : "production"];
    }

    // static
    static canGetCertificate ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [domains];

        if ( !domains.length ) return false;

        for ( const domain of domains ) {
            try {
                if ( domain.startsWith( "*." ) ) {
                    const hostname = new Hostname( domain.substring( 2 ) );

                    if ( !( hostname.isValid && hostname.isRootDomain ) ) {
                        return false;
                    }
                }
                else {
                    const hostname = new Hostname( domain );

                    if ( !( hostname.isValid && ( hostname.isRootDomain || hostname.isRootSubdomain ) ) ) {
                        return false;
                    }
                }
            }
            catch ( e ) {
                return false;
            }
        }

        return true;
    }

    // properties
    get accountKey () {
        return this.#accountKey;
    }

    get accountUrl () {
        return this.#accountUrl;
    }

    // public
    async getCertificate ( { domains, checkDomain, createChallenge, deleteChallenge } = {} ) {
        var res;

        if ( !Array.isArray( domains ) ) domains = [domains];

        // pre-check domains
        if ( !this.canGetCertificate( domains ) ) return result( [400, `Domains are not valid`] );

        // init
        if ( !this.#accountUrl ) {
            res = await this.createAccount();
            if ( !res.ok ) return res;
        }

        // prepare domains
        const index = {},
            counter = new Counter();

        for ( const name of domains ) {
            counter.value++;

            const isWildcard = name.startsWith( "*." ),
                domain = isWildcard ? name.substring( 2 ) : name,
                dnsTxtRecordName = `_acme-challenge.${domain}`;

            dns.lookup( domain, ( e, address ) => {
                index[name] = {
                    name,
                    isWildcard,
                    domain,
                    dnsTxtRecordName,
                    "resolved": address,
                };

                counter.value--;
            } );
        }

        await counter.wait();

        // pre-check domains
        if ( checkDomain ) {
            let checked = true;

            const counter = new Counter();

            for ( const record of Object.values( index ) ) {
                counter.value++;

                checkDomain( { ...record } ).then( canGetCertificate => {
                    if ( !canGetCertificate ) checked = false;

                    counter.value--;
                } );
            }

            await counter.wait();

            if ( !checked ) return result( [400, `Domains check failed`] );
        }

        // create order
        res = await this.#createOrder( {
            "identifiers": domains.map( domain => {
                return { "type": "dns", "value": domain };
            } ),
        } );
        if ( !res.ok ) return res;

        const order = res.data;

        res = await this.#getAuthorizations( order );
        if ( !res.ok ) return res;

        const authorizations = res.data;

        for ( const authorization of authorizations ) {
            const record = index[authorization.identifier.value];

            let authorizationDone;

            for ( const challenge of authorization.challenges ) {
                const type = challenge.type,
                    httpLocation = `/.well-known/acme-challenge/${challenge.token}`,
                    token = challenge.token,
                    content = this.#getChallengeKeyAuthorization( challenge );

                if ( record.isWildcard && type !== "dns-01" ) continue;

                if ( type === "http-01" && !record.resolved ) continue;

                try {

                    // create challenge
                    const challengeCreated = await createChallenge( {
                        ...record,
                        type,
                        httpLocation,
                        token,
                        content,
                    } );

                    if ( !challengeCreated ) continue;

                    // verify challenge
                    res = await this.#verifyChallenge( {
                        ...record,
                        type,
                        httpLocation,
                        token,
                        content,
                    } );

                    if ( !res.ok ) throw res;

                    // complete challenge
                    res = await this.#completeChallenge( challenge );
                    if ( !res.ok ) throw res;

                    // wait for challenge verified
                    res = await this.#waitForValidStatus( challenge.url );

                    if ( !res.ok ) throw res;

                    authorizationDone = true;
                }
                catch ( e ) {}

                // delete challenge
                await deleteChallenge( {
                    ...record,
                    type,
                    httpLocation,
                    token,
                } );

                if ( authorizationDone ) break;
            }

            // authorization failed
            if ( !authorizationDone ) {

                // deactivate authorization
                await this.#deactivateAuthorization( authorization );

                return result( [500, `ACME failed to perform authorization for domain: "${record.name}"`] );
            }
        }

        // create csr
        const { privateKey, csr } = await this.#createCsr( domains );

        // finalize orfer
        res = await this.#finalizeOrder( order, csr );
        if ( !res.ok ) return res;

        res = await this.#getCertificate( res.data );
        if ( !res.ok ) return res;

        const certificateData = new crypto.X509Certificate( res.data );

        return result( 200, {
            "certificate": res.data.toString(),
            privateKey,
            "expires": new Date( certificateData.validTo ),
        } );
    }

    async createAccount () {
        var res;

        if ( !this.#accountUrl ) {

            // generate account key
            if ( this.#mutex.tryLock() ) {
                if ( !this.#accountKey ) {
                    const keyPair = await new Promise( ( resolve, reject ) => {
                        crypto.generateKeyPair(
                            "ec",
                            {
                                "namedCurve": "P-256",
                            },
                            ( e, publicKey, privateKey ) => {
                                if ( e ) {
                                    reject( e );
                                }
                                else {
                                    resolve( { publicKey, privateKey } );
                                }
                            }
                        );
                    } );

                    this.#accountKey = keyPair.privateKey.export( {
                        "type": "pkcs8",
                        "format": "pem",
                    } );
                }

                // create account
                res = await this.#createAccount();

                this.#mutex.unlock( res );
            }
            else {
                res = await this.#mutex.wait();
            }

            if ( !res.is2xx ) return res;
        }

        return result( 200 );
    }

    canGetCertificate ( domains ) {
        return this.constructor.canGetCertificate( domains );
    }

    // private
    async #createAccount () {
        const res = await this.#apiResourceRequest(
            "newAccount",
            {
                "termsOfServiceAgreed": true,
                "contact": ["mailto:" + this.#email],
            },
            {
                "includeJwsKid": false,
            }
        );

        // account created
        if ( res.status === 200 || res.status === 201 ) {
            this.#accountUrl = res.meta.location;
        }

        return res;
    }

    async #updateAccount ( data ) {
        return this.#apiRequest( this.#accountUrl, data );
    }

    async #createOrder ( data ) {
        const res = await this.#apiResourceRequest( "newOrder", data );

        if ( res.status !== 201 ) {
            return res;
        }
        else if ( !res.meta.location ) {
            return result( [500, `ACME account url not reeturned`] );
        }
        else {
            res.data.url = res.meta.location;

            return result( 200, res.data );
        }
    }

    async #getAuthorizations ( order ) {
        const data = [];

        for ( const url of order.authorizations || [] ) {
            const res = await this.#apiRequest( url );

            if ( !res.ok ) return res;

            res.data.url = url;

            data.push( res.data );
        }

        return result( 200, data );
    }

    #getChallengeKeyAuthorization ( challenge ) {
        const jwk = this.#getJwk(),
            keysum = crypto.createHash( "sha256" ).update( JSON.stringify( jwk ) ),
            thumbprint = keysum.digest( "base64url" ),
            res = `${challenge.token}.${thumbprint}`;

        if ( challenge.type === "http-01" ) {
            return res;
        }
        else if ( challenge.type === "dns-01" || challenge.type === "tls-alpn-01" ) {
            const shasum = crypto.createHash( "sha256" ).update( res );

            return shasum.digest( "base64url" );
        }
    }

    async #verifyChallenge ( { type, domain, dnsTxtRecordName, httpLocation, content } ) {
        var attempt;

        if ( type === "http-01" ) {
            attempt = 10;
        }
        else {
            attempt = 20;
        }

        TEST: while ( true ) {

            // http
            if ( type === "http-01" ) {
                const res = await fetch( `http://${domain}${httpLocation}` );

                if ( res.ok ) {
                    const text = await res.text();

                    if ( text === content ) {
                        return result( 200 );
                    }
                    else {
                        break TEST;
                    }
                }
            }

            // dns
            else if ( type === "dns-01" ) {
                try {
                    const record = await dns.promises.resolveTxt( dnsTxtRecordName );

                    for ( const row of record ) {
                        for ( const value of row ) {
                            if ( value === content ) return result( 200 );
                        }
                    }
                }
                catch ( e ) {}
            }

            // not supported
            else {
                return result( 200 );
            }

            attempt--;

            if ( !attempt ) break;

            await sleep( 3000 );
        }

        return result( [500, `Challenge verification error`] );
    }

    async #completeChallenge ( challenge ) {
        return this.#apiRequest( challenge.url, {} );
    }

    async #waitForValidStatus ( url ) {
        while ( true ) {
            const res = await this.#apiRequest( url );

            // request error
            if ( !res.ok ) return res;

            // complete
            if ( STATUSES.ready.has( res.data.status ) ) {
                return res;
            }

            // inlid
            else if ( STATUSES.invalid.has( res.data.status ) ) {
                return result( [500, `Challenge is not valid`] );
            }

            // pending
            else if ( STATUSES.pending.has( res.data.status ) ) {
                await sleep( 3000 );
            }
        }
    }

    async #deactivateAuthorization ( authorization ) {
        const data = {
            "status": "deactivated",
        };

        const res = await this.#apiRequest( authorization.url, data );

        if ( !res.ok ) return res;

        res.data.url = authorization.url;

        return res;
    }

    async #finalizeOrder ( order, csr ) {
        csr = Buffer.from( forge.pki.pemToDer( csr ).getBytes(), "latin1" ).toString( "base64url" );

        const res = await this.#apiRequest( order.finalize, {
            csr,
        } );

        if ( !res.ok ) return res;

        res.data.url = order.url;

        return res;
    }

    async #getCertificate ( order ) {
        var res;

        if ( !STATUSES.ready.has( order.status ) ) {
            res = await this.#waitForValidStatus( order.url );

            if ( !res.ok ) return res;

            order = res.data;
        }

        if ( !order.certificate ) {
            return result( [500, "Unable to download certificate, URL not found"] );
        }

        res = await this.#apiRequest( order.certificate );

        return res;
    }

    async #getResourceUrl ( resource ) {
        if ( !this.#directories ) {
            const res = await this.#getDirectories();

            if ( !res.ok ) return res;
        }

        const url = this.#directories[resource];

        if ( !url ) return result( [400, `Resource url not found`] );

        return result( 200, url );
    }

    async #getDirectories () {
        if ( !this.#directories ) {
            const res = await fetch( this.#directory );

            if ( !res.ok ) return res;

            this.#directories = await res.json();
        }

        return result( 200, this.#directories );
    }

    async #apiRequest ( url, data, { includeJwsKid = true } = {} ) {
        const kid = includeJwsKid ? this.#accountUrl : null;

        const res = await this.#signedRequest( url, data, {
            kid,
        } );

        return res;
    }

    async #apiResourceRequest ( resource, data, { includeJwsKid = true } = {} ) {
        var res;

        res = await this.#getResourceUrl( resource );
        if ( !res.ok ) return res;

        const url = res.data;

        return this.#apiRequest( url, data, {
            includeJwsKid,
        } );
    }

    async #signedRequest ( url, payload, { kid = null, nonce = null } = {}, attempts = 0 ) {
        if ( !nonce ) {
            const res = await this.#getNonce();
            if ( !res.ok ) return res;

            nonce = res.data;
        }

        // sign body and send request
        const data = this.#createSignedBody( url, payload, { nonce, kid } );

        const res = await fetch( url, {
            "method": "post",
            "headers": {
                "content-type": "application/jose+json",
            },
            "body": JSON.stringify( data ),
        } );

        var body;

        if ( res.ok && res.headers.contentType.type === "application/pem-certificate-chain" ) {
            body = await res.buffer();
        }
        else {
            body = await res.json().catch( e => null );

            // retry on bad nonce - https://tools.ietf.org/html/draft-ietf-acme-acme-10#section-6.4
            if ( res.status === 400 && body?.type === "urn:ietf:params:acme:error:badNonce" && attempts < this.maxBadNonceRetries ) {
                nonce = res.headers.get( "replay-nonce" ) || null;

                attempts += 1;

                return this.#signedRequest(
                    url,
                    payload,
                    {
                        kid,
                        nonce,
                    },
                    attempts
                );
            }
        }

        /* Return response */
        return result( [res.status, body?.detail], body, {
            "location": res.headers.get( "location" ),
            "link": res.headers.get( "link" ),
        } );
    }

    async #getNonce () {
        var res;

        res = await this.#getResourceUrl( "newNonce" );
        if ( !res.ok ) return res;

        res = await fetch( res.data, {
            "methos": "head",
        } );

        const nonce = res.headers.get( "replay-nonce" );

        if ( !nonce ) {
            return result( [500, `Get nonce failed`] );
        }
        else {
            return result( 200, nonce );
        }
    }

    #createSignedBody ( url, payload = null, { nonce = null, kid = null } = {} ) {
        const jwk = this.#getJwk();

        let headerAlg = "RS256",
            signerAlg = "SHA256";

        // https://datatracker.ietf.org/doc/html/rfc7518#section-3.1
        if ( jwk.crv && jwk.kty === "EC" ) {
            headerAlg = "ES256";

            if ( jwk.crv === "P-384" ) {
                headerAlg = "ES384";
                signerAlg = "SHA384";
            }
            else if ( jwk.crv === "P-521" ) {
                headerAlg = "ES512";
                signerAlg = "SHA512";
            }
        }

        // prepare body and signer
        const res = this.#prepareSignedBody( headerAlg, url, payload, { nonce, kid } );

        const signer = crypto.createSign( signerAlg ).update( `${res.protected}.${res.payload}`, "utf8" );

        // signature - https://stackoverflow.com/questions/39554165
        res.signature = signer.sign(
            {
                "key": this.#accountKey,
                "padding": crypto.RSA_PKCS1_PADDING,
                "dsaEncoding": "ieee-p1363",
            },
            "base64url"
        );

        return res;
    }

    #getJwk () {
        this.#jwk ??= this.#createJwk( this.#accountKey );

        return this.#jwk;
    }

    #createJwk ( key ) {
        const jwk = crypto.createPublicKey( key ).export( {
            "format": "jwk",
        } );

        /* Sort keys */
        return Object.keys( jwk )
            .sort()
            .reduce( ( result, key ) => {
                result[key] = jwk[key];

                return result;
            }, {} );
    }

    #prepareSignedBody ( alg, url, payload = null, { nonce = null, kid = null } = {} ) {
        const header = { alg, url };

        // nonce
        if ( nonce ) {
            header.nonce = nonce;
        }

        // kID or jwk
        if ( kid ) {
            header.kid = kid;
        }
        else {
            header.jwk = this.#getJwk();
        }

        return {
            "payload": payload ? Buffer.from( JSON.stringify( payload ) ).toString( "base64url" ) : "",
            "protected": Buffer.from( JSON.stringify( header ) ).toString( "base64url" ),
        };
    }

    #createSignedHmacBody ( hmacKey, url, payload = null, { nonce = null, kid = null } = {} ) {
        const result = this.#prepareSignedBody( "HS256", url, payload, { nonce, kid } );

        // signature
        const signer = crypto.createHmac( "SHA256", Buffer.from( hmacKey, "base64" ) ).update( `${result.protected}.${result.payload}`, "utf8" );

        result.signature = signer.digest().toString( "base64url" );

        return result;
    }

    async #createCsr ( domains ) {
        return certificates.createCsr( domains, {
            "privateKey": this.#accountKey,
        } );
    }
}
