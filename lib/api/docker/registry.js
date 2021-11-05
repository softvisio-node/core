import fetch from "#lib/fetch";
import { parseWwwAuthenticateHeader } from "#lib/utils/http";

// NOTE https://docs.docker.com/registry/spec/api/

const DEFAULT_REGISTRY = "index.docker.io";
const API_VERSION = "v2";

export default class DockerRegistry {
    #username;
    #password;
    #registry;

    #id;
    #basicAuth;
    #bearerAuth = {};

    constructor ( username, password, registry ) {
        this.#username = username;
        this.#password = password;
        this.#registry = registry || DEFAULT_REGISTRY;
    }

    // properties
    get id () {
        this.#id ??= this.#registry + ":" + this.#username;

        return this.#id;
    }

    // public
    async getCatalog () {
        const url = "https://" + this.#registry + "/" + API_VERSION + "/_catalog";

        const res = await this.#request( url );

        if ( !res.ok ) return res;

        const data = await res.json();

        return result( 200, data );
    }

    async getTags ( repo ) {
        const url = "https://" + this.#registry + "/" + API_VERSION + "/" + repo + "/tags/list";

        const res = await this.#request( url );

        if ( !res.ok ) return res;

        const data = await res.json();

        return result( 200, data );
    }

    async getManifest ( repo, tag ) {
        const url = "https://" + this.#registry + "/" + API_VERSION + "/" + repo + "/manifests/" + ( tag || "latest" );

        const res = await this.#request( url );

        if ( !res.ok ) return res;

        const data = await res.json();

        return result( 200, data );
    }

    // private
    #getBasicAuth () {
        this.#basicAuth ??= "Basic " + Buffer.from( this.#username + ":" + this.#password ).toString( "base64" );

        return this.#basicAuth;
    }

    async #getBearerAuth ( url ) {
        if ( this.#bearerAuth[url] && this.#bearerAuth[url].expires > Date.now() ) return this.#bearerAuth[url].token;

        const res = await fetch( url, {
            "headers": { "authorization": this.#getBasicAuth() },
        } );

        if ( !res.ok ) return;

        const json = await res.json();

        this.#bearerAuth[url] = {
            "expires": Date.parse( json.issued_at ) + json.expires_in * 1000 - 3000,
            "token": "Bearer " + json.token,
        };

        return this.#bearerAuth[url].token;
    }

    async #request ( url ) {
        var authorization;

        while ( 1 ) {
            const res = await fetch( url, { "headers": { authorization } } );

            if ( !res.ok ) {

                // authorization error
                if ( res.status === 401 ) {

                    // invalid auth
                    if ( authorization ) return result( res );

                    let wwwAuthenticate = res.headers.get( "www-authenticate" );

                    if ( !wwwAuthenticate ) return result( res );

                    wwwAuthenticate = parseWwwAuthenticateHeader( wwwAuthenticate );

                    if ( wwwAuthenticate.type === "basic" ) {
                        authorization = this.#getBasicAuth();
                    }
                    else if ( wwwAuthenticate.type === "bearer" ) {
                        const url = wwwAuthenticate.realm + "?service=" + wwwAuthenticate.service + "&scope=" + wwwAuthenticate.scope;

                        authorization = await this.#getBearerAuth( url );

                        // unable to get bearer token
                        if ( !authorization ) return result( res );
                    }
                    else {
                        return result( [500, `Invalid auth type`] );
                    }

                    // repeat request with authorization
                    continue;
                }

                // other error
                else {
                    return result( res );
                }
            }

            // ok
            else {
                return res;
            }
        }
    }
}
