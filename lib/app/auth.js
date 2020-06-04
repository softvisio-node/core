const { mixin } = require( "../mixins" );
const { ROOT_USER_NAME, ROOT_USER_ID } = require( "../const" );
const { result, parseResult } = require( "../result" );

class Auth {
    #app;
    #api;
    #token;

    isAuthenticated = false;
    userId;
    userName;
    groups = [];

    constructor ( app, token, options ) {
        this.#app = app;
        this.#api = app.getApi();
        this.#token = token;

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

        if ( !method ) return result( [404, "Method Not Found"] );

        try {
            return parseResult( await method.object[method.codeName]( this, ...args ) );
        }
        catch ( e ) {
            return result( [500, "Internal Server Error"] );
        }
    }
}

module.exports.Auth = Auth;

module.exports = mixin( ( Super ) =>
    class extends Super {
        async authenticate ( token ) {
            if ( !token ) {
                new Auth();
            }
            else {
                return this.backend.authenticate( token );
            }
        }

        userIsRoot ( userId ) {
            return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
        }
    } );
