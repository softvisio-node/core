import "#index";

import crypto from "crypto";
import fetch from "#lib/http/fetch";
import { URLSearchParams } from "url";

const JWT_HEADER = Buffer.from( JSON.stringify( { "alg": "RS256", "typ": "JWT" } ) ).toString( "base64url" );

export default class GoogleOAuth {
    #key;
    #scope;
    #token;
    #pkey;

    constructor ( key, scope ) {
        this.#key = key;
        this.#scope = scope;

        this.#pkey = crypto.createPrivateKey( this.#key.private_key );
    }

    // https://developers.google.com/identity/protocols/OAuth2ServiceAccount#authorizingrequests
    async getToken () {
        const issueTime = Math.round( new Date().getTime() / 1000 );

        if ( this.#token && this.#token.expire > issueTime ) return result( 200, this.#token.access_token );

        const jwtClaimSet = Buffer.from( JSON.stringify( {
            "aud": "https://www.googleapis.com/oauth2/v4/token",
            "iss": this.#key.client_email,
            "scope": this.#scope,
            "iat": issueTime,
            "exp": issueTime + 60 * 60, // 1 hour
        } ) ).toString( "base64url" );

        const sign = crypto.createSign( "RSA-SHA256" );
        sign.update( JWT_HEADER + "." + jwtClaimSet );
        sign.end();

        const jwtSignature = sign.sign( this.#pkey ).toString( "base64url" );

        const jwt = JWT_HEADER + "." + jwtClaimSet + "." + jwtSignature;

        var res = await fetch( "https://www.googleapis.com/oauth2/v4/token", {
            "method": "post",
            "body": new URLSearchParams( {
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": jwt,
            } ),
        } );

        if ( !res.ok ) {
            this.#token = null;

            // my $error = $res->{data} ? from_json $res->{data} : undef;
            // $token = res $res;
            // $token->{reason} = $error->{error_description} if $error;

            return result( 500 );
        }
        else {
            this.#token = await res.json();

            this.#token.expire = issueTime + this.#token.expires_in;

            return result( 200, this.#token.access_token );
        }
    }
}
