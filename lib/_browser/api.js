import Common from "./api/common.js";
import _Upload from "./api/upload.js";
import result from "#lib/result";

class AptClientUpload extends _Upload {
    #size;

    #formData;
    #abortController;

    constructor ( api, method, file, args ) {
        super( api, method, file );

        const formData = new FormData();

        if ( args.length ) {
            formData.append( "params", new Blob( [JSON.stringify( args )], { "type": "application/json" } ) );
        }

        formData.append( "file", file, file.name );

        this.#size = file.size;

        this.#formData = formData;
    }

    get size () {
        return this.#size;
    }

    // protected
    async _start ( api, method ) {
        const request = new XMLHttpRequest();

        // set expected response type
        request.responseType = "text";

        this._abortController = request;

        request.open( "POST", api.uploadUrl.href + method );

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

        url = new URL( url || "/api/", base );

        if ( !url.pathname.endsWith( "/" ) ) url.pathname += "/";

        return url;
    }

    async _dnsLookup () {
        return new Set( [this.hostname] );
    }

    _dnsReset () {}
}
