const { mixin } = require( "../mixins" );
const { ROOT_USER_NAME, ROOT_USER_ID } = require( "../const" );
const { res, parseRes } = require( "../result" );

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

module.exports.Auth = class Auth {
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

        if ( !method ) return res( [404, "Method Not Found"] );

        try {
            return parseRes( await method.object[method.codeName]( this, ...args ) );
        }
        catch ( e ) {
            return res( [500, "Internal Server Error"] );
        }
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 9:21          | no-undef                     | 'Auth' is not defined.                                                         |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
