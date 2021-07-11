import "#index";

import Common from "#browser/api/common";
import _Upload from "#browser/api/upload";
import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";
import MSGPACK from "#lib/msgpack";
import dns from "dns";

class APIClientUpload extends _Upload {
    #size;

    #formData;
    #abortController;

    constructor ( api, method, file, args ) {
        if ( typeof file === "string" ) file = { "path": file };

        file = File.new( file );

        super( api, method, file );

        const formData = new FormData();

        if ( args.length ) {
            if ( api.json ) {
                formData.append( "params", JSON.stringify( args ), { "contentType": "application/json" } );
            }
            else {
                formData.append( "params", MSGPACK.encode( args ), { "contentType": "application/msgpack" } );
            }
        }

        formData.append( "file", file.stream(), {
            "filename": this.filename,
            "contentType": this.type,
            "knownLength": file.size,
        } );

        // check, that we know content length
        if ( !formData.hasKnownLength() ) {
            this._setResult( result( [400, `Content length is unknown`] ) );
        }
        else {
            this.#size = formData.getLengthSync();

            this.#formData = formData;
        }
    }

    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, method ) {
        this.#abortController = new AbortController();

        this._setProgress( this.#size / 2 );

        const formData = this.#formData;
        this.#formData = null;

        const headers = { ...formData.getHeaders(), "Host": api.hostname };

        if ( api.token ) headers.Authorization = "Bearer " + api.token;

        var res;

        try {
            res = await fetch( api.uploadURL.href + method, {
                "method": "post",
                headers,
                "body": formData,
            } );

            this.#abortController = null;

            const contentType = res.headers.get( "content-type" ) ?? "";

            let msg;

            // read response body
            if ( contentType.startsWith( "application/json" ) ) {
                try {
                    msg = await res.json();
                }
                catch ( e ) {

                    // message decode error
                    throw result( -32807 );
                }
            }
            else if ( contentType.startsWith( "application/msgpack" ) ) {
                try {
                    msg = MSGPACK.decode( await res.arrayBuffer() );
                }
                catch ( e ) {

                    // message decode error
                    throw result( -32807 );
                }
            }
            else {

                // request error
                if ( !res.ok ) {
                    throw res;
                }

                // invalid content type
                else {
                    throw result( -32803 );
                }
            }

            // set progress to 100%
            this._setProgress( this.#size );

            res = result.parseRPC( msg );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this._setResult( res );
    }

    _abort () {
        if ( !this.#abortController ) return false;

        this.#abortController.abort();
        this.#abortController = null;

        return true;
    }
}

export default class APIClient extends Common {

    // properties
    get isBrowser () {
        return false;
    }

    get Upload () {
        return APIClientUpload;
    }

    // protected
    _resolveURL ( url ) {
        url = new URL( url );

        if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";

        return url;
    }

    async _lookup ( hostname ) {
        return dns.promises.lookup( hostname, { "all": true, "family": 0 } );
    }
}
