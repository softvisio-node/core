const Backend = require( "../backend" );

module.exports = class extends Backend {
    constructor ( app, api, url ) {
        super( app, api );
    }
};
