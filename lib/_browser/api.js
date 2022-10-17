import Common from "./api/common.js";
import _Upload from "./api/upload.js";
import result from "#lib/result";
import { objectIsPlain } from "#lib/utils";

class AptClientUpload extends _Upload {
    #size = 0;
    #formData;
    #abortController;

    constructor ( api, method, formData ) {
        super( api, method );

        if ( formData instanceof FormData ) {
            this.#formData = formData;
        }
        else {
            this.#formData = new FormData();

            for ( var [name, body, filename] of formData ) {
                if ( objectIsPlain( filename ) ) {
                    ( { filename } = filename );
                }

                if ( !( body instanceof Blob ) ) {
                    body = new Blob( [JSON.stringify( body )], { "type": "application/json" } );
                }
            }

            this.#size += body.size;
            this.#formData.append( name, body, filename );
        }
    }

    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, url ) {
        const request = new XMLHttpRequest();

        // set expected response type
        request.responseType = "text";

        this._abortController = request;

        request.open( "POST", url );

        if ( api.token ) request.setRequestHeader( "Authorization", "Bearer " + api.token );

        // progress
        request.upload.addEventListener( "progress", e => {
            this.#size = e.total;

            this._setProgress( e.loaded );
        } );

        // error
        request.addEventListener( "error", e => {
            this._abortController = null;

            this._setResult( result( [request.status, request.statusText] ) );
        } );

        // done
        request.addEventListener( "load", e => {
            var res;

            try {
                const contentType = request.getResponseHeader( "content-type" ) ?? "";

                let msg;

                // read response body
                if ( contentType.startsWith( "application/json" ) ) {
                    try {
                        msg = JSON.parse( request.response );
                    }
                    catch ( e ) {

                        // message decode error
                        throw result( -32807 );
                    }
                }
                else {

                    // invalid content type
                    throw result( -32803 );
                }

                res = result.parseRpc( msg );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            this._setResult( res );
        } );

        request.send( this.#formData );

        this.#formData = null;
    }

    _abort () {
        if ( !this.#abortController ) return false;

        this.#abortController.abort();
        this.#abortController = null;

        return true;
    }
}

export default class AptClient extends Common {

    // properties
    get isBrowser () {
        return true;
    }

    get Upload () {
        return AptClientUpload;
    }

    // protected
    _resolveUrl ( url ) {
        const base = new URL( window.location.href );

        base.username = "";
        base.password = "";
        base.search = "";
        base.hash = "";

        url = new URL( url, base );

        if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";

        if ( !url.searchParams.get( "persistent" ) ) url.searchParams.set( "persistent", "true" );

        return url;
    }

    async _dnsLookup () {
        return new Set( [this.hostname] );
    }

    _dnsReset () {}
}
