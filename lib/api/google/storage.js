import Oauth from "#lib/api/google/oauth";
import fetch from "#lib/fetch";
import { readConfig } from "#lib/config";

const BASE_URL = "https://storage.googleapis.com/storage/v1/";

export default class FirebaseMessaging {
    #key;
    #oauth;

    constructor ( key ) {
        this.#key = typeof key === "string" ? readConfig( key ) : key;

        this.#oauth = new Oauth( this.#key, "https://www.googleapis.com/auth/devstorage.full_control" );
    }

    // properties
    get projectId () {
        return this.#key.project_id;
    }

    get baseUrl () {
        return BASE_URL;
    }

    // public
    // https://cloud.google.com/storage/docs/json_api/v1/buckets/insert
    async createBucket ( name ) {
        return this.#request( this.baseUrl + "b", {
            "params": {
                "project": this.projectId,
            },
            "request": {
                "method": "post",
                "headers": {
                    "content-type": "application/json",
                },
                "body": JSON.stringify( {
                    name,
                } ),
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/buckets/list
    async listBuckets () {
        return this.#request( this.baseUrl + "b", {
            "params": {
                "project": this.projectId,
            },
        } );
    }

    // private
    async #request ( url, { params, request = {} } = {} ) {
        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        url = new URL( url );

        if ( params ) url.search = new URLSearchParams( params );

        request.headers ||= {};
        request.headers.authorization = `Bearer ${token.data}`;

        const res = await fetch( url, request );

        const data = await res.json().catch( e => null );

        if ( res.ok ) {
            return result( 200, data );
        }
        else {
            return result( [res.status, data?.error?.message || res.statusText] );
        }
    }
}
