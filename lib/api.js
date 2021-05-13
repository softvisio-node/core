import "#index";

import Common from "#lib/api/client/common";
import UploadCommon from "#lib/api/client/upload";
import WebSocket from "ws";
import fetch from "#lib/http/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";
import MSGPACK from "#lib/msgpack";

class Upload extends UploadCommon {
    #size;

    #formData;
    #abortController;

    constructor ( api, method, file, data, onProgress ) {
        if ( typeof file === "string" ) file = { "path": file };

        file = File.new( file );

        super( api, method, file, onProgress );

        const formData = new FormData();

        if ( data !== undefined ) {
            if ( api.json ) {
                formData.append( "data", JSON.stringify( data ), { "contentType": "application/json" } );
            }
            else {
                formData.append( "data", MSGPACK.encode( data ), { "contentType": "application/msgpack" } );
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

        const headers = { ...formData.getHeaders() };

        if ( api.token ) headers.Authorization = "Bearer " + api.token;

        var res;

        try {
            res = await fetch( api.httpUrl.href + method, {
                "method": "post",
                headers,
                "body": formData,
            } );

            this.#abortController = null;

            if ( !res.ok ) throw result( [res.status, res.reason] );

            const contentType = res.headers.get( "content-type" );

            var data;

            // read response body
            if ( contentType === "application/json" ) {
                data = await res.json();
            }
            else if ( contentType === "application/msgpack" ) {
                data = MSGPACK.decode( await res.arrayBuffer() );
            }
            else {
                throw result( [500, `Content type is invalid`] );
            }

            // set progress to 100%
            this._setProgress( this.#size );

            res = result.parseResult( data );
        }
        catch ( e ) {
            res = result.catchResult( e );
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

export default class extends Common {

    // websocket
    // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
    get _WebSocket () {
        return WebSocket;
    }

    // http
    get _fetch () {
        return fetch;
    }

    // upload
    get Upload () {
        return Upload;
    }
}
