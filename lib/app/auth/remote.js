const Auth = require( "../auth" );

module.exports = class extends Auth {
    constructor ( app, url ) {
        super( app );
    }
};
