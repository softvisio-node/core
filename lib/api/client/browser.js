const { mix } = require( "@softvisio/core/lib/mixins" );
const ApiBase = require( "./base" );
const Upload = require( "./browser/upload" );
const EventEmitter = require( "eventemitter3" );

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

        super.setUrl( url );
    }

    // method, file, args?, cb?
    async upload () {
        const method = arguments[0],
            file = arguments[1];

        let args, onProgress;

        // parse arguments
        if ( arguments[2] ) {
            if ( typeof arguments[2] === "function" ) {
                onProgress = arguments[2];
            }
            else {
                args = arguments[2];
                onProgress = arguments[3];
            }
        }

        const upload = new Upload( file, onProgress );

        await upload._start( this, method, args );

        return upload;
    }

    _createConnection ( url ) {
        const ws = new WebSocket( url, "softvisio" );

        ws.binaryType = "blob";

        ws.onopen = this._onOpen.bind( this );

        ws.onerror = this._onError.bind( this );

        ws.onclose = this._onClose.bind( this );

        ws.onmessage = ( e ) => {
            this._onMessage( e.data );
        };

        return ws;
    }
}

module.exports = class extends mix( ApiBase, BrowserApiClient ) {};
