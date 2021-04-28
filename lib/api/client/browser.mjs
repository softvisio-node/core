// import "#index";
import "@softvisio/core";

import Common from "./common.js";
import { createSHA1 } from "hash-wasm";

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

    uploadCloseFile ( fh ) {}

    async uploadCreateHashObject () {
        const sha1 = await createSHA1();

        sha1.init();

        return sha1;
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
