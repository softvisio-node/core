import Oauth from "#lib/api/google/oauth";
import fetch from "#lib/fetch";

const DEFAULT_PERMISSION = "fullControl";

const SCOPES = {
    "readOnly": "https://www.googleapis.com/auth/devstorage.read_only",
    "readWrite": "https://www.googleapis.com/auth/devstorage.read_write",
    "fullControl": "https://www.googleapis.com/auth/devstorage.full_control",
    "cloudPlatformReadOnly": "https://www.googleapis.com/auth/cloud-platform.read-only",
    "cloudPlatform": "https://www.googleapis.com/auth/cloud-platform",
};

const API_URL = "https://storage.googleapis.com/storage/v1/",
    UPLOAD_URL = "https://storage.googleapis.com/upload/storage/v1/";

export default class FirebaseMessaging {
    #oauth;
    #permission;

    constructor ( key, { permission } = {} ) {
        this.#permission = permission || DEFAULT_PERMISSION;
        this.#oauth = new Oauth( key, SCOPES[this.#permission] );
    }

    // properties
    get permission () {
        return this.#permission;
    }

    // public
    // https://cloud.google.com/storage/docs/json_api/v1/buckets/insert
    async createBucket ( bucket, { predefinedAcl } = {} ) {
        return this.#request( API_URL + "b", {
            "params": {
                "project": this.#oauth.projectId,
                predefinedAcl,
            },
            "request": {
                "method": "post",
                "headers": {
                    "content-type": "application/json",
                },
                "body": JSON.stringify( {
                    "name": bucket,
                } ),
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/buckets/list
    async getBuckets () {
        return this.#request( API_URL + "b", {
            "params": {
                "project": this.#oauth.projectId,
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/buckets/get
    async getBucket ( bucket ) {
        return this.#request( API_URL + "b/" + encodeURIComponent( bucket ) );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/buckets/delete
    // XXX force delete non-empty bucket
    async deleteBucket ( bucket ) {
        return this.#request( API_URL + "b/" + encodeURIComponent( bucket ), {
            "request": {
                "method": "delete",
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/objects/insert
    async uploadFile ( path, file ) {
        const { bucket, name } = this.#parsePath( path );

        return this.#request( UPLOAD_URL + `b/${encodeURIComponent( bucket )}/o`, {
            "params": {
                "name": name,
                "uploadType": "media",
            },
            "request": {
                "method": "post",
                "headers": {

                    // "content-type": "application/json",
                },
                "body": file.stream,
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/objects/list
    async getFiles ( bucket ) {
        return this.#request( API_URL + `b/${encodeURIComponent( bucket )}/o` );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/objects/get
    async getFile ( path ) {
        const { bucket, name } = this.#parsePath( path );

        return this.#request( API_URL + `b/${encodeURIComponent( bucket )}/o/${encodeURIComponent( name )}` );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/objects/delete
    async deleteFile ( path ) {
        const { bucket, name } = this.#parsePath( path );

        return this.#request( API_URL + `b/${encodeURIComponent( bucket )}/o/${encodeURIComponent( name )}`, {
            "request": {
                "method": "delete",
            },
        } );
    }

    // https://cloud.google.com/storage/docs/json_api/v1/objects/copy
    async copyFile ( from, to ) {
        from = this.#parsePath( from );
        to = this.#parsePath( to );

        return this.#request( API_URL + `b/${encodeURIComponent( from.bucket )}/o/${encodeURIComponent( from.name )}/copyTo/b/${encodeURIComponent( to.bucket )}/o/${encodeURIComponent( to.name )}`, {
            "request": {
                "method": "post",
            },
        } );
    }

    // private
    #parsePath ( path ) {
        const idx = path.indexOf( "/" );

        return {
            "bucket": path.substring( 0, idx ),
            "name": path.substring( idx + 1 ),
        };
    }

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
