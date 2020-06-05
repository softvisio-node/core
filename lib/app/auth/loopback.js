const Auth = require( "../auth" );

module.exports = class extends Auth {
    constructor ( app, api ) {
        super( app, api );
    }
};
