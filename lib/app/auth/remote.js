const Auth = require( "../auth" );

module.exports = class extends Auth {
    constructor ( app, api, url ) {
        super( app, api );
    }
};
