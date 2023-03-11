import crypto from "node:crypto";
import fetch from "#lib/fetch";
import { readConfig } from "#lib/config";
import Mutex from "#lib/threads/mutex";

const DEFAULT_TTL = 60 * 60; // 1 hour

const JWT_HEADER = Buffer.from( JSON.stringify( { "alg": "RS256", "typ": "JWT" } ) ).toString( "base64url" );

export default class GoogleOauth {
    #key;
    #scope;
    #ttl;
    #pkey;
    #mutex = new Mutex();
    #token;

    constructor ( key, scope, { ttl } = {} ) {
        this.#key = typeof key === "string" ? readConfig( key ) : key;
        this.#scope = scope;
        this.#ttl = ttl || DEFAULT_TTL;

        this.#pkey = crypto.createPrivateKey( this.#key.private_key );
    }

    // properties
    get scope () {
        return this.#scope;
    }

    get projectId () {
        return this.#key.project_id;
    }

    // public
    // https://developers.google.com/identity/protocols/OAuth2ServiceAccount#authorizingrequests
    async getToken () {
        const issueTime = Math.round( new Date().getTime() / 1000 );

        if ( this.#token && this.#token.expire > issueTime ) return result( 200, this.#token.access_token );

        if ( !this.#mutex.tryDown() ) return !this.#mutex.signal.wait();

        const jwtClaimSet = Buffer.from( JSON.stringify( {
            "aud": this.#key.token_uri,
            "iss": this.#key.client_email,
            "scope": this.#scope,
            "iat": issueTime,
            "exp": issueTime + this.#ttl,
        } ) ).toString( "base64url" );

        const sign = crypto.createSign( "RSA-SHA256" );
        sign.update( JWT_HEADER + "." + jwtClaimSet );
        sign.end();

        const jwtSignature = sign.sign( this.#pkey ).toString( "base64url" );

        const jwt = JWT_HEADER + "." + jwtClaimSet + "." + jwtSignature;

        var res = await fetch( this.#key.token_uri, {
            "method": "post",
            "body": new URLSearchParams( {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": jwt,
            } ),
        } );

        const data = await res.json().catch( e => null );

        if ( res.ok ) {
            this.#token = data;

            this.#token.expire = issueTime + this.#token.expires_in;

            res = result( 200, this.#token.access_token );
        }
        else {
            res = result( [res.status, data?.error_description || res.statusText] );
        }

        this.#mutex.signal.broadcast( res );
        this.#mutex.up();

        return res;
    }
}
