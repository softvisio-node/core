import "#index";

import Common from "./common.js";
import UploadCommon from "#lib/api/client/upload";

// import result from "#lib/result";

class Upload extends UploadCommon {

    // XXX
    async _start ( api, method, file, data ) {}

    // XXX
    _abort () {}
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

    // websocket
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

    uploadGetFileName ( file ) {
        return file.name;
    }

    async uploadGetFileStats ( file ) {
        return {
            "size": file.size,
            "type": file.type,
        };
    }

    async uploadOpenFile ( file ) {
        return file;
    }

    async uploadReadFileChunk ( fh, offset, length ) {
        const chunk = fh.slice( offset, offset + length );

        return new Promise( function ( resolve ) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve( new Uint8Array( reader.result ) );
            };

            reader.readAsArrayBuffer( chunk );
        } );
    }

    uploadChunk ( method, id, offset, chunk ) {
        return this.call( method, {
            id,
            offset,
            "chunk": chunk.buffer,
        } );
    }
}
