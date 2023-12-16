import "#lib/result";
import crypto from "node:crypto";
import fetch from "#lib/fetch";

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

// XXX
const verify = {};

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

    constructor ( { provider, test, email, accountKey } = {} ) {
        if ( !Buffer.isBuffer( accountKey ) ) {
            accountKey = Buffer.from( accountKey );
        }

        this.#email = email;
        this.#accountKey = accountKey;

        this.#directory = DIRECTORIES[provider][test ? "staging" : "production"];
    }

    // static
    static async createPrivateKey () {
        return this.#createPrivateEcdsaKey();
    }

    static async #createPrivateEcdsaKey ( namedCurve = "P-256" ) {
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

    // properties
    get accountKey () {
        return this.#accountKey;
    }

    get accountUrl () {
        return this.#accountUrl;
    }

    // public
    // XXX
    async getCertificates ( { domains, createChallenge, deleteChallenge } = {} ) {
        var res;

        if ( !Array.isArray( domains ) ) domains = [domains];

        // create account
        if ( !this.#accountUrl ) {
            res = await this.#createAccount();

            if ( !res.is2xx ) return res;
        }

        // create order
        res = await this.#createOrder( {
            "identifiers": domains.map( domain => {
                return { "type": "dns", "value": domain };
            } ),
        } );
        console.log( res );
        process.exit();

        if ( !res.ok ) return res;

        const order = res.data;

        res = await this.getAuthorizations( order );
        if ( !res.ok ) return res;

        const authorizations = res.data;

        let complete;

        for ( const authorization of authorizations ) {
            for ( const challenge of authorization.challenges ) {
                try {
                    res = await this.getChallengeKeyAuthorization( challenge );
                    if ( !res.ok ) throw res;

                    const keyAuthorization = res.data;

                    res = await createChallenge( authorization, challenge, keyAuthorization );
                    if ( !res ) throw res;

                    res = await this.verifyChallenge( authorization, challenge );
                    if ( !res.ok ) throw res;

                    res = await this.completeChallenge( challenge );
                    if ( !res.ok ) throw res;

                    res = await this.waitForValidStatus( challenge );
                    if ( !res.ok ) throw res;

                    complete = true;
                }
                catch ( e ) {}

                // XXX
                await deleteChallenge( authorization, challenge );

                if ( complete ) break;
            }

            // XXX
            await this.deactivateAuthorization( authorization );
        }
    }

    async getAuthorizations ( order ) {
        const data = [];

        for ( const url of order.authorizations || [] ) {
            const res = await this.#apiRequest( url );

            if ( !res.ok ) return res;

            res.data.url = url;

            data.push( res.data );
        }

        return result( 200, data );
    }

    getChallengeKeyAuthorization ( challenge ) {
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

    // XXX
    async verifyChallenge ( authz, challenge ) {
        if ( !authz.url || !challenge.url ) {
            return result( [500, "Unable to verify ACME challenge, URL not found"] );
        }

        if ( typeof verify[challenge.type] === "undefined" ) {
            return result( [500, `Unable to verify ACME challenge, unknown type: ${challenge.type}`] );
        }

        // XXX
        const keyAuthorization = this.getChallengeKeyAuthorization( challenge );

        const verifyFn = async () => {
            await verify[challenge.type]( authz, challenge, keyAuthorization );
        };

        // XXX
        return this.util.retry( verifyFn, this.backoffOpts );
    }

    async completeChallenge ( challenge ) {
        return this.#apiRequest( challenge.url, {} );
    }

    // XXX
    async waitForValidStatus ( item ) {
        if ( !item.url ) {
            return result( [500, "Unable to verify status of item, URL not found"] );
        }

        const verifyFn = async abort => {
            const res = await this.#apiRequest( item.url );

            if ( STATUSES.invalid.has( res.data.status ) ) {
                abort();

                // XXX
                throw new Error( this.util.formatResponseError( res ) );
            }
            else if ( STATUSES.pending.has( res.data.status ) ) {
                throw new Error( "Operation is pending or processing" );
            }
            else if ( STATUSES.ready.has( res.data.status ) ) {
                return res.data;
            }

            return result( [500, `Unexpected item status: ${res.data.status}`] );
        };

        // XXX
        return this.util.retry( verifyFn, this.backoffOpts );
    }

    async deactivateAuthorization ( authz ) {
        if ( !authz.url ) {
            return result( [500, "Unable to deactivate identifier authorization, URL not found"] );
        }

        const data = {
            "status": "deactivated",
        };

        const res = await this.#apiRequest( authz.url, data );

        if ( !res.ok ) return res;

        res.data.url = authz.url;

        return res;
    }

    // XXX
    async finalizeOrder ( order, csr ) {
        if ( !order.finalize ) {
            return result( [500, "Unable to finalize order, URL not found"] );
        }

        if ( !Buffer.isBuffer( csr ) ) {
            csr = Buffer.from( csr );
        }

        const data = { "csr": this.#getPemBodyAsB64u( csr ) },
            res = await this.#apiRequest( order.finalize, data );

        if ( !res.ok ) return res;

        res.data.url = order.url;

        return res;
    }

    // XXX
    async getCertificate ( order, preferredChain = null ) {
        if ( !STATUSES.ready.has( order.status ) ) {
            order = await this.waitForValidStatus( order );
        }

        if ( !order.certificate ) {
            return result( [500, "Unable to download certificate, URL not found"] );
        }

        const res = await this.#apiRequest( order.certificate );

        /* Handle alternate certificate chains */
        if ( preferredChain && res.headers.link ) {

            // XXX
            const alternateLinks = this.util.parseLinkHeader( res.headers.link );

            const alternates = await Promise.all( alternateLinks.map( async link => this.#apiRequest( link ) ) );

            // XXX
            const certificates = [res].concat( alternates ).map( c => c.data );

            // XXX
            return this.util.findCertificateChainForIssuer( certificates, preferredChain );
        }

        return res;
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
            return result( 500 );
        }
        else if ( !res.meta.location ) {
            return result( 500 );
        }
        else {
            res.data.url = res.meta.location;

            return result( 200, res.data );
        }
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

        const json = await res.json().catch( e => null );

        // retry on bad nonce - https://tools.ietf.org/html/draft-ietf-acme-acme-10#section-6.4
        if ( res.status === 400 && json?.type === "urn:ietf:params:acme:error:badNonce" && attempts < this.maxBadNonceRetries ) {
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

        /* Return response */
        return result( res.status, json, {
            "location": res.headers.get( "location" ),
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
        if ( !this.#jwk ) {
            const jwk = crypto.createPublicKey( this.#accountKey ).export( {
                "format": "jwk",
            } );

            /* Sort keys */
            this.#jwk = Object.keys( jwk )
                .sort()
                .reduce( ( result, k ) => {
                    result[k] = jwk[k];

                    return result;
                }, {} );
        }

        return this.#jwk;
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

    // XXX
    #getPemBodyAsB64u = pem => {
        const chain = this.#splitPemChain( pem );

        if ( !chain.length ) {
            throw new Error( "Unable to parse PEM body from string" );
        }

        return this.#jsrsasign.hextob64u( this.#jsrsasign.pemtohex( chain[0] ) );
    };

    // XXX
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
                .map( ( [pem, header] ) => this.#jsrsasign.hextopem( this.#jsrsasign.pemtohex( pem, header ), header ) )
        );
    }

    // XXX
    #jsrsasign () {}
}
