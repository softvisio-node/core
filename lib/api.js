require( "#index" );

const Common = require( "#lib/api/client/common" );

const Websocket = require( "ws" );
const fetch = require( "#lib/http/fetch" );

module.exports = class extends Common {

    // websocket
    // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
    get _Websocket () {
        return Websocket;
    }

    // http
    get _fetch () {
        return fetch;
    }

    // upload
};
