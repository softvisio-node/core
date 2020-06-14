import { mix } from "@softvisio/core/lib/mixins";
import ApiBase from "./base";
import EventEmitter from "eventemitter3";
import { createSHA1 } from "hash-wasm";

class BrowserApiClient extends EventEmitter {
    setUrl ( url ) {
        const a = document.createElement( "a" );

        a.href = url || "/api";

        url = new URL( a.href );

        if ( url.protocol !== "ws:" && url.protocol !== "wss:" ) {
            if ( url.protocol === "https:" ) {
                url.protocol = "wss:";
            }
            else {
                url.protocol = "ws:";
            }
        }

        if ( url.username ) {
            this.setToken( url.username );

            url.username = "";
            url.password = "";
        }

        return url;
    }

    _createConnection ( url ) {
        const ws = new WebSocket( url, "softvisio" );

        ws.binaryType = "arraybuffer";

        ws.onopen = this._onOpen.bind( this );

        ws.onerror = this._onError.bind( this );

        ws.onclose = this._onClose.bind( this );

        ws.onmessage = ( e ) => {
            this._onMessage( e.data );
        };

        return ws;
    }

    // UPLOAD
    async uploadGetFileParams ( file ) {
        return {
            "name": file.name,
            "size": file.size,
            "type": file.type,
        };
    }

    async uploadCreateHashObject () {
        const sha1 = await createSHA1();

        sha1.init();

        return sha1;
    }

    async uploadReadFileChunk ( file, offset, length ) {
        const chunk = file.slice( offset, offset + length );

        return new Promise( function ( resolve ) {
            const reader = new FileReader();

            reader.onload = function () {
                resolve( reader.result );
            };

            reader.readAsBinaryString( chunk );
        } );
    }
}

module.exports = class extends mix( ApiBase, BrowserApiClient ) {};
