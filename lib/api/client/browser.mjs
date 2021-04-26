// import "#index";
import "@softvisio/core";

import Common from "./common.js";

module.exports = class extends Common {
    _resolveUrl ( url ) {
        return new URL( url || "/api", window.location.href );
    }

    // http
    get _fetch () {
        return fetch;
    }
};
