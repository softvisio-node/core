const { mix } = require( "@softvisio/core/lib/mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );
const EventEmitter = require( "events" );
const crypto = require( "crypto" );

class NodeApiClient extends EventEmitter {
    setUrl ( url ) {
        url = new URL( url );

        if ( url.username ) {
            this.setToken( url.username );

            url.username = "";
            url.password = "";
        }

        return url;
    }

    _createConnection ( url ) {

        // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
        const ws = new WebSocket( url, "softvisio", {} );

        ws.on( "error", this._onError.bind( this ) );

        ws.on( "open", this._onOpen.bind( this ) );

        ws.on( "close", this._onClose.bind( this ) );

        ws.on( "message", this._onMessage.bind( this ) );

        return ws;
    }

    // UPLOAD
    uploadGetFileParams ( file ) {
        return {
            "name": file,
            "size": 123,
            "type": "mime/type",
        };
    }

    async uploadCreateHashObject () {
        return crypto.createHash( "SHA1" );
    }
}

module.exports = class extends mix( ApiBase, NodeApiClient ) {};
