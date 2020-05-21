const { mixin, mix } = require( "../mixins" );
const WebSocket = require( "ws" );
const ApiBase = require( "./client/base" );

const Transport = mixin( ( Super ) =>
    class extends Super {
        // TODO
        async upload () {}

        _connect ( url ) {
            // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
            const ws = new WebSocket( url, "softvisio", {} );

            ws.on( "error", this._onError.bind( this ) );

            ws.on( "open", this._onOpen.bind( this ) );

            ws.on( "close", this._onClose.bind( this ) );

            ws.on( "message", this._onMessage.bind( this ) );

            return ws;
        }
    } );

module.exports = class extends mix( ApiBase, Transport ) {};
