const { mixin } = require( "../mixins" );
const res = require( "../result" );

const ROOT_USER_NAME = "root";
const ROOT_USER_ID = 1;

class Auth {
    #app = null;
    #api = null;
    #privateToken = null;

    isAuthenticated = false;
    userId = null;
    userName = null;
    groups = [];

    constructor ( app, api, privateToken, options ) {
        this.#app = app;
        this.#api = api;
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
    // TODO convert result
    async call ( methodId, ...args ) {
        var method = this.#api.getMethod( methodId );

        if ( !method ) return res( [404, "Method Not Found"] );

        try {
            var result = await method.object[method.codeName]( this, ...args );

            // TODO convert result
            return res( ...result );
        }
        catch ( e ) {
            return res( [500, "Internal Server Error"] );
        }
    }
}

module.exports = mixin( ( Super ) =>
    class extends Super {
        // TODO perform auth
        async authenticate ( token ) {
            return new Auth( this, this.getApi(), null, {
                "isAuthenticated": true,
                "userId": 199,
                "userName": "root",
                "groups": ["admin", "user"],
            } );
        }

        userIsRoot ( userId ) {
            return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
        }
    } );
