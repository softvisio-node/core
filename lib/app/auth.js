const { mixin } = require( "../mixins" );
const res = require( "../result" );

class Auth {
    #app = null;
    #api = null;
    #privateToken = null;

    is_authenticated = false;
    user_id = null;
    user_name = null;

    constructor ( app, api, privateToken, options ) {
        this.#app = app;
        this.#api = api;
        this.#privateToken = privateToken;

        Object.assign( this, options );
    }

    async call ( methodId, ...args ) {
        var method = this.#api.getMethod( methodId );

        if ( !method ) return res( [404, "Method Not Found"] );

        try {
            var result = await method.object[method.codeName]( this, ...args );

            return res( ...result );
        }
        catch ( e ) {
            return res( [500, "Internal Server Error"] );
        }
    }
}

module.exports = mixin( ( Super ) =>
    class extends Super {
        async authenticate ( token ) {
            return new Auth( this, this.getApi(), null, {
                "user_id": 199,
                "user_name": "root",
                "groups": ["admin", "user"],
            } );
        }
    } );
