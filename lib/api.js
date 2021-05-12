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

    // file:
    // name, size, type
    // path, data
    // XXX json || msgpack
    constructor ( api, method, file, data, onProgress ) {
        super( api, method, data, onProgress );

        if ( typeof file === "string" ) file = { "path": file };

        file = File.new( file );

        this.#filename = file.name ?? "blob";
        this.#type = file.type || "application/octet-stream";
        this.#size = file.size;

        const formData = new FormData();

        // XXX json || msgpack
        if ( data ) formData.append( "data", JSON.stringify( data ) );

        formData.append( "file", file.stream, {
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

    // XXX
    async _start ( api, method, data ) {
        this._setProgress( this.#size / 2 );

        // XXX url, auth
        const res = await fetch( "http://127.0.0.1", {
            "method": "post",
            "headers": this.#formData.getHeaders(),
            "body": this.#formData,
        } );

        if ( !res.ok ) return result( [res.status, res.reason] );

        const contentType = res.headers.get( "content-type" );

        // read response body
        if ( contentType === "application/json" ) {
            data = await res.json();
        }
        else if ( contentType === "application/msgpack" ) {
            data = MSGPACK.decode( await res.arrayBuffer() );
        }
        else throw `Content type is invalid`;

        // set progress to 100%
        this._setBytesSent( this.#size );

        return result.parseResult( data );
    }

    // XXX
    _abort () {}
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
