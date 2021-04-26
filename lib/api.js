require( "#index" );

const Common = require( "#lib/api/client/common" );

const WebSocket = require( "ws" );
const fetch = require( "#lib/http/fetch" );

module.exports = class extends Common {

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
};
