import "#index";

import Common from "#lib/api/client/common";
import UploadCommon from "#lib/api/client/upload";
import WebSocket from "ws";
import fetch from "#lib/http/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";
import MSGPACK from "#lib/msgpack";

class Upload extends UploadCommon {
    #filename;
    #size;
    #type;

    #formData;
    #controller;

    constructor ( api, method, file, data, onProgress ) {
        super( api, method, onProgress );

        if ( typeof file === "string" ) file = { "path": file };

        file = File.new( file );

        this.#filename = file.name ?? "blob";
        this.#type = file.type || "application/octet-stream";
        this.#size = file.size;

        const formData = new FormData();

        if ( data ) {
            if ( api.json ) {
                formData.append( "data", JSON.stringify( data ), { "contentType": "application/json" } );
            }
            else {
                formData.append( "data", MSGPACK.encode( data ), { "contentType": "application/msgpack" } );
            }
        }

        formData.append( "file", file.stream(), {
            "filename": this.#filename,
            "contentType": this.#type,
            "knownLength": this.#size,
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

    get filename () {
        return this.#filename;
    }

    get size () {
        return this.#size;
    }

    get type () {
        return this.#type;
    }

    // protected
    async _start ( api, method ) {
        this.#controller = new AbortController();

        this._setProgress( this.#size / 2 );

        const headers = { ...this.#formData.getHeaders() };

        if ( api.token ) headers.Authorization = "Bearer " + api.token;

        const res = await fetch( api.httpUrl.href + method, {
            "method": "post",
            headers,
            "body": this.#formData,
        } );

        this.#controller = null;

        if ( !res.ok ) return this._setResult( result( [res.status, res.reason] ) );

        const contentType = res.headers.get( "content-type" );

        var data;

        // read response body
        if ( contentType === "application/json" ) {
            data = await res.json();
        }
        else if ( contentType === "application/msgpack" ) {
            data = MSGPACK.decode( await res.arrayBuffer() );
        }
        else throw `Content type is invalid`;

        // set progress to 100%
        this._setProgress( this.#size );

        this._setResult( result.parseResult( data ) );
    }

    _abort () {
        if ( this.isStarted ) {
            if ( this.#controller ) {
                this.#controller.abort();

                return true;
            }
            else return false;
        }
        else return true;
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
