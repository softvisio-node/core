require( "#index" );

const Common = require( "#lib/api/client/common" );

const fetch = require( "#lib/http/fetch" );

module.exports = class extends Common {

    // http
    get _fetch () {
        return fetch;
    }
};
