// import "#index";
import "@softvisio/core";

import Common from "./common.js";

export default class extends Common {
    _resolveUrl ( url ) {
        return new URL( url || "/api", window.location.href );
    }

    // websocket
    get _WebSocket () {
        return WebSocket;
    }

    // http
    get _fetch () {
        return fetch;
    }
}
