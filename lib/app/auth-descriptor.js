const { result, parseResult } = require( "../result" );

module.exports = class Auth {
    #api;
    #token;

    isAuthenticated = false;
    userId;
    userName;
    permissions = {};

    constructor ( api, token, options ) {
        this.#api = app.getApi();
        this.#token = token;

        Object.assign( this, options );
    }

    isRoot () {
        return this.isAuthenticated && this.#api.userIsRoot( this.userId );
    }

    isGuest () {
        return !this.isAuthenticated;
    }

    isUser () {
        return this.isAuthenticated;
    }

    // TODO re-validate private token
    // TODO check perms
    async call ( methodId, ...args ) {
        var method = this.#api.getMethod( methodId );

        if ( !method ) return result( [404, "Method Not Found"] );

        try {
            return parseResult( await method.object[method.codeName]( this, ...args ) );
        }
        catch ( e ) {
            return result( [500, "Internal Server Error"] );
        }
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 13:21         | no-undef                     | 'app' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
