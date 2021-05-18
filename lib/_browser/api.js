import "#index";

import Common from "./api/common.js";
import _Upload from "./api/upload.js";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";

class Upload extends _Upload {
    #size;

    #formData;
    #abortController;

    constructor ( api, method, file, data, onProgress ) {
        super( api, method, file, onProgress );

        const formData = new FormData();

        if ( data !== undefined ) {
            if ( api.json ) {
                formData.append( "data", new Blob( [JSON.stringify( data )], { "type": "application/json" } ) );
            }
            else {
                formData.append( "data", new Blob( [MSGPACK.encode( data )], { "type": "application/msgpack" } ) );
            }
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

        this._abortController = request;

        request.open( "POST", api.httpUrl.href + method );

        if ( api.token ) request.setRequestHeader( "Authorization", "Bearer " + api.token );

        // progress
        request.upload.addEventListener( "progress", e => {
            this.#size = e.total;

            this._setProgress( e.loaded );
        } );

        // error
        request.addEventListener( "error", e => {
            this._abortController = null;

            this._setResult( [request.status, request.statusText] );
        } );

        // done
        request.addEventListener( "load", e => {
            var res;

            try {
                const contentType = request.getResponseHeader( "content-type" );

                let data;

                // read response body
                if ( contentType.startsWith( "application/json" ) ) {
                    data = JSON.parse( request.response );
                }
                else if ( contentType.startsWith( "application/msgpack" ) ) {
                    data = MSGPACK.decode( request.response );
                }
                else {
                    throw result( [500, `Content type is invalid`] );
                }

                res = result.parseResult( data );
            }
            catch ( e ) {
                res = result.catchResult( e );
            }

            this._setResult( res );
        } );

        const formData = this.#formData;
        this.#formData = null;

        request.send( formData );
    }

    _abort () {
        if ( !this.#abortController ) return false;

        this.#abortController.abort();
        this.#abortController = null;

        return true;
    }
}

export default class extends Common {
    _resolveUrl ( url ) {
        const base = new URL( window.location.href );

        base.username = "";
        base.password = "";
        base.search = "";
        base.hash = "";

        return new URL( url || "/api", base );
    }

    // upload
    get Upload () {
        return Upload;
    }

    // protected
    async _lookup ( hostname ) {
        return [{ "address": hostname }];
    }
}
