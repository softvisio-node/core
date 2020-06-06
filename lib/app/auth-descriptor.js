const { result, parseResult } = require( "../result" );

module.exports = class AuthDescriptor {
    #api;
    #token;

    isAuthenticated = false;
    userId;
    userName;
    permissions = {};

    constructor ( api, token, options ) {
        this.#api = api;
        this.#token = token;

        Object.assign( this, options );

        if ( this.userId ) this.isAuthenticated = true;
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

    compare ( privateToken ) {
        return privateToken.hash === this.#token.hash;
    }

    clone ( api ) {
        return new AuthDescriptor( api, this.#token, this );
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
