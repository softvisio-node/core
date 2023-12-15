import "#lib/result";
import crypto from "node:crypto";
import fetch from "#lib/fetch";

const directories = {
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

export default class Acme {
    #directory;
    #accountKey;
    #email;
    #accountUrl;
    #directories;
    #maxBadNonceRetries = 3;
    #jwk;

    constructor ( { provider, test, accountKey, email } = {} ) {
        this.#accountKey = accountKey;
        this.#email = email;

        this.#directory = directories[provider][test ? "staging" : "production"];
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
    async createAccount ( email ) {
        const data = {
            "termsOfServiceAgreed": true,
            "contact": ["mailto:" + email],
        };

        if ( this.#accountUrl ) {
            return this.#updateAccount( data );
        }
        else {
            const res = await this.#createAccount( data );

            if ( res.ok ) {
                return this.#updateAccount( data );
            }
            else {
                return res;
            }
        }
    }

    async createOrder ( data ) {
        const res = await this.#apiResourceRequest( "newOrder", data, [201] );

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

    // private
    // XXX
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
        if ( res.status === 301 ) {
            this.#accountUrl = res.meta.location;
        }

        return res;
    }

    // XXX
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

        return this.#apiRequest( res.data, data, {
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
        return result( res.status, json, { "location": res.headers.get( "location" ) } );
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
}
