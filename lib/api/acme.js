import "#lib/result";
import crypto from "node:crypto";
import fetch from "#lib/fetch";
import { sleep } from "#lib/utils";
import dns from "node:dns";
import net from "node:net";
import jsrsasign from "jsrsasign";
import Mutex from "#lib/threads/mutex";
import Hostname from "#lib/hostname";

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

    constructor ( { provider, test, email, accountKey } = {} ) {
        this.#email = email;

        if ( accountKey ) {
            if ( !Buffer.isBuffer( accountKey ) ) {
                accountKey = Buffer.from( accountKey );
            }

            this.#accountKey = accountKey;
        }

        this.#directory = DIRECTORIES[provider][test ? "staging" : "production"];
    }

    // properties
    get accountKey () {
        return this.#accountKey;
    }

    get accountUrl () {
        return this.#accountUrl;
    }

    // public
    async getCertificate ( { domains, createChallenge, deleteChallenge } = {} ) {
        var res;

        if ( !Array.isArray( domains ) ) domains = [domains];

        // pre-check domains
        for ( const domain of domains ) {
            if ( domain.startsWith( "*." ) ) {
                const hostname = new Hostname( domain.substring( 2 ) );

                if ( !( hostname.isValid && hostname.isRootDomain ) ) {
                    return result( [400, `Domains are not valid`] );
                }
            }
            else {
                const hostname = new Hostname( domain );

                if ( !( hostname.isValid && ( hostname.isRootDomain || hostname.isRootSubdomain ) ) ) {
                    return result( [400, `Domains are not valid`] );
                }
            }
        }

        // init
        if ( !this.#accountUrl ) {
            res = await this.createAccount();
            if ( !res.ok ) return res;
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
            const name = authorization.identifier.value,
                isWildcard = name.startsWith( "*." ),
                domain = isWildcard ? name.substring( 2 ) : name,
                dnsTxtRecordName = `_acme-challenge.${domain}`;

            let authorizationDone;

            for ( const challenge of authorization.challenges ) {
                const type = challenge.type,
                    httpLocation = `/.well-known/acme-challenge/${challenge.token}`,
                    token = challenge.token,
                    content = this.#getChallengeKeyAuthorization( challenge );

                if ( isWildcard && type !== "dns-01" ) continue;

                if ( type === "http-01" ) {
                    try {
                        await dns.promises.lookup( domain );
                    }
                    catch ( e ) {
                        continue;
                    }
                }

                try {

                    // create challenge
                    const challengeCreated = await createChallenge( {
                        type,
                        domain,
                        dnsTxtRecordName,
                        httpLocation,
                        token,
                        content,
                    } );

                    console.log( `ACME: ${domain}, ${type}, challenge created: ${challengeCreated}` );

                    if ( !challengeCreated ) continue;

                    // verify challenge
                    res = await this.#verifyChallenge( {
                        type,
                        domain,
                        dnsTxtRecordName,
                        httpLocation,
                        token,
                        content,
                    } );

                    console.log( `ACME: ${domain}, ${type}, challenge verify: ${res}` );

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
                    type,
                    domain,
                    dnsTxtRecordName,
                    httpLocation,
                    token,
                } );

                if ( authorizationDone ) break;
            }

            // authorization failed
            if ( !authorizationDone ) {

                // deactivate authorization
                await this.#deactivateAuthorization( authorization );

                return result( [500, `ACME failed to perform authorization for domain: "${name}"`] );
            }
        }

        // create csr
        const [key, csr] = await this.#createCsr( domains );

        // finalize orfer
        res = await this.#finalizeOrder( order, csr );
        if ( !res.ok ) return res;

        res = await this.#getCertificate( res.data );
        if ( !res.ok ) return res;

        return result( 200, {
            key,
            "certificate": res.data,
        } );
    }

    async createAccount () {
        var res;

        if ( !this.#accountUrl ) {

            // generate account key
            if ( this.#mutex.tryLock() ) {
                if ( !this.#accountKey ) {
                    this.#accountKey = await this.#createPrivateEcdsaKey();
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

    async #updateAccountKey ( newAccountKey, data = {} ) {
        if ( !Buffer.isBuffer( newAccountKey ) ) {
            newAccountKey = Buffer.from( newAccountKey );
        }

        // get old JWK
        data.account = this.#accountUrl;
        data.oldKey = this.#getJwk();

        const oldAccountKey = this.#accountKey,
            oldJwk = this.#jwk;

        this.#accountKey = newAccountKey;
        this.#jwk = null;

        // get signed request body from new client
        const url = await this.#getResourceUrl( "keyChange" ),
            body = this.#createSignedBody( url, data );

        const newJwk = this.#jwk;

        this.#accountKey = oldAccountKey;
        this.#jwk = oldJwk;

        // change key using old client
        const res = this.#apiResourceRequest( "keyChange", body );

        if ( res.ok ) {
            this.#accountKey = newAccountKey;
            this.#jwk = newJwk;
        }

        return res;
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
            attempt = 10;
        }

        while ( true ) {

            // http
            if ( type === "http-01" ) {
                const res = await fetch( `http://${domain}${httpLocation}` );

                // XXX
                console.log( "---", res + "" );

                if ( res.ok ) {
                    const text = await res.text();

                    // XXX
                    console.log( content );
                    console.log( text );
                    console.log( text === content );

                    if ( text === content ) return result( 200 );
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
        if ( !Buffer.isBuffer( csr ) ) {
            csr = Buffer.from( csr );
        }

        const res = await this.#apiRequest( order.finalize, {
            "csr": this.#getPemBodyAsB64u( csr ),
        } );

        if ( !res.ok ) return res;

        res.data.url = order.url;

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
            .reduce( ( result, k ) => {
                result[k] = jwk[k];

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

    #getKeyInfo ( keyPem ) {
        const info = {
            "isRSA": false,
            "isECDSA": false,
            "signatureAlgorithm": null,
            "publicKey": crypto.createPublicKey( keyPem ),
        };

        if ( info.publicKey.asymmetricKeyType === "rsa" ) {
            info.isRSA = true;
            info.signatureAlgorithm = "SHA256withRSA";
        }
        else if ( info.publicKey.asymmetricKeyType === "ec" ) {
            info.isECDSA = true;
            info.signatureAlgorithm = "SHA256withECDSA";
        }
        else {
            throw new Error( "Unable to parse key information, unknown format" );
        }

        return info;
    }

    async #createCsr ( domains ) {
        const commonName = domains[0],
            altNames = domains,
            data = {};

        const keyPem = await this.#createPrivateEcdsaKey();

        /* Get key info and JWK */
        const info = this.#getKeyInfo( keyPem ),
            jwk = this.#createJwk( keyPem ),
            extensionRequests = [];

        // missing support for NIST curve names in jsrsasign
        // https://github.com/kjur/jsrsasign/blob/master/src/asn1x509-1.0.js#L4388-L4393
        if ( jwk.crv && jwk.kty === "EC" ) {
            jwk.crv = this.#convertNistCurveNameToSecg( jwk.crv );
        }

        // XXX
        // ensure subject common name is present in SAN - https://cabforum.org/wp-content/uploads/BRv1.2.3.pdf
        // if ( data.commonName && !data.altNames.includes( data.commonName ) ) {
        //     data.altNames.unshift( data.commonName );
        // }

        // subject
        const subject = this.#createCsrSubject( {
            "CN": commonName,
            "C": data.country,
            "ST": data.state,
            "L": data.locality,
            "O": data.organization,
            "OU": data.organizationUnit,
            "E": data.emailAddress,
        } );

        // sAN extension
        if ( altNames.length ) {
            extensionRequests.push( {
                "extname": "subjectAltName",
                "array": this.#formatCsrAltNames( altNames ),
            } );
        }

        // create CSR
        const csr = new jsrsasign.KJUR.asn1.csr.CertificationRequest( {
            "subject": { "array": subject },
            "sigalg": info.signatureAlgorithm,
            "sbjprvkey": keyPem.toString(),
            "sbjpubkey": jwk,
            "extreq": extensionRequests,
        } );

        // sign CSR, get PEM
        csr.sign();

        return [keyPem, Buffer.from( csr.getPEM() )];
    }

    #createCsrSubject ( input ) {
        return Object.entries( input ).reduce( ( res, [type, value] ) => {
            if ( value ) {
                const ds = this.#getCsrAsn1CharStringType( type );

                res.push( [{ type, value, ds }] );
            }

            return res;
        }, [] );
    }

    #getCsrAsn1CharStringType ( field ) {
        switch ( field ) {
        case "C":
            return "prn";
        case "E":
            return "ia5";
        default:
            return "utf8";
        }
    }

    #convertNistCurveNameToSecg ( nistName ) {
        switch ( nistName ) {
        case "P-256":
            return "secp256r1";
        case "P-384":
            return "secp384r1";
        case "P-521":
            return "secp521r1";
        default:
            return nistName;
        }
    }

    #formatCsrAltNames ( altNames ) {
        return altNames.map( value => {
            const key = net.isIP( value ) ? "ip" : "dns";

            return { [key]: value };
        } );
    }

    async #getCertificate ( order, preferredChain = null ) {
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

        /* Handle alternate certificate chains */
        // if ( preferredChain && res.meta.link ) {
        //     const alternateLinks = this.#parseLinkHeader( res.headers.link );

        //     const alternates = await Promise.all( alternateLinks.map( async link => this.#apiRequest( link ) ) );

        //     const certificates = [res].concat( alternates ).map( c => c.data );

        //
        //     return this.#findCertificateChainForIssuer( certificates, preferredChain );
        // }

        return res;
    }

    #getPemBodyAsB64u = pem => {
        const chain = this.#splitPemChain( pem );

        if ( !chain.length ) {
            throw new Error( "Unable to parse PEM body from string" );
        }

        return jsrsasign.hextob64u( jsrsasign.pemtohex( chain[0] ) );
    };

    #splitPemChain ( chainPem ) {
        if ( Buffer.isBuffer( chainPem ) ) {
            chainPem = chainPem.toString();
        }

        return (
            chainPem

                /* Split chain into chunks, starting at every header */
                .split( /\s*(?=-----BEGIN [A-Z0-9- ]+-----\r?\n?)/g )

                /* Match header, PEM body and footer */
                .map( pem => pem.match( /\s*-----BEGIN ([A-Z0-9- ]+)-----\r?\n?([\S\s]+)\r?\n?-----END \1-----/ ) )

                /* Filter out non-matches or empty bodies */
                .filter( pem => pem && pem[2] && pem[2].replace( /[\r\n]+/g, "" ).trim() )

                /* Decode to hex, and back to PEM for formatting etc */
                .map( ( [pem, header] ) => jsrsasign.hextopem( jsrsasign.pemtohex( pem, header ), header ) )
        );
    }

    async #createPrivateEcdsaKey ( namedCurve = "P-256" ) {
        const pair = await new Promise( ( resolve, reject ) => {
            crypto.generateKeyPair(
                "ec",
                {
                    namedCurve,
                    "privateKeyEncoding": {
                        "type": "pkcs8",
                        "format": "pem",
                    },
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

        return Buffer.from( pair.privateKey );
    }

    #parseLinkHeader ( header, rel = "alternate" ) {
        const relRe = new RegExp( `\\s*rel\\s*=\\s*"?${rel}"?`, "i" );

        const results = ( header || "" ).split( /,\s*</ ).map( link => {
            const [, linkUrl, linkParts] = link.match( /<?([^>]*)>;(.*)/ ) || [];
            return linkUrl && linkParts && linkParts.match( relRe ) ? linkUrl : null;
        } );

        return results.filter( r => r );
    }

    #findCertificateChainForIssuer ( chains, issuer ) {
        let bestMatch = null,
            bestDistance = null;

        chains.forEach( chain => {

            /* Look up all issuers */
            const certs = this.#splitPemChain( chain );
            const infoCollection = certs.map( c => this.#readCertificateInfo( c ) );
            const issuerCollection = infoCollection.map( i => i.issuer.commonName );

            /* Found issuer match, get distance from root - lower is better */
            if ( issuerCollection.includes( issuer ) ) {
                const distance = issuerCollection.length - issuerCollection.indexOf( issuer );

                /* Chain wins, use it */
                if ( !bestDistance || distance < bestDistance ) {
                    bestMatch = chain;

                    bestDistance = distance;
                }
            }
            else {

                /* No match */
            }
        } );

        /* Return found match */
        if ( bestMatch ) {
            return bestMatch;
        }

        /* No chains matched, return default */
        return chains[0];
    }

    #readCertificateInfo ( certPem ) {
        const chain = this.#splitPemChain( certPem );

        if ( !chain.length ) {
            throw new Error( "Unable to parse PEM body from string" );
        }

        /* Parse certificate */
        const obj = new jsrsasign.X509();
        obj.readCertPEM( chain[0] );
        const params = obj.getParam();

        return {
            "issuer": {
                "commonName": this.#parseCommonName( params.issuer ),
            },
            "domains": this.#parseDomains( params ),
            "notBefore": jsrsasign.zulutodate( params.notbefore ),
            "notAfter": jsrsasign.zulutodate( params.notafter ),
        };
    }

    #parseCommonName ( subj ) {
        const subjectArr = subj && subj.array ? subj.array : [];

        const cnArr = subjectArr.find( s => s[0] && s[0].type && s[0].value && s[0].type === "CN" );

        return cnArr && cnArr.length && cnArr[0].value ? cnArr[0].value : null;
    }

    #parseDomains ( params ) {
        const commonName = this.#parseCommonName( params.subject );
        const extensionArr = params.ext || params.extreq || [];
        let altNames = [];

        if ( extensionArr && extensionArr.length ) {
            const altNameExt = extensionArr.find( e => e.extname && e.extname === "subjectAltName" );
            const altNameArr = altNameExt && altNameExt.array && altNameExt.array.length ? altNameExt.array : [];
            altNames = altNameArr.map( a => Object.values( a )[0] || null ).filter( a => a );
        }

        return {
            commonName,
            altNames,
        };
    }
}
