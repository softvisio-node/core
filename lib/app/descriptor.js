const { res, parseRes } = require( "../result" );

module.exports = class Auth {
    #app = null;
    #api = null;
    #privateToken = null;

    isAuthenticated = false;
    userId = null;
    userName = null;
    groups = [];

    constructor ( app, privateToken, options ) {
        this.#app = app;
        this.#api = app.getApi();
        this.#privateToken = privateToken;

        Object.assign( this, options );
    }

    isRoot () {
        return this.isAuthenticated && this.#app.userIsRoot( this.userId );
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

        if ( !method ) return res( [404, "Method Not Found"] );

        try {
            return parseRes( await method.object[method.codeName]( this, ...args ) );
        }
        catch ( e ) {
            return res( [500, "Internal Server Error"] );
        }
    }
};
