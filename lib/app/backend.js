const { Auth } = require( "./auth" );
const crypto = require( "crypto" );

const TOKEN_TYPE_PASSWORD = 1;

module.exports = class {
    #app;

    constructor ( app ) {
        this.#app = app;
    }

    async init () {
        await this.#app.threads.run( {
            "argon2": {
                "num": 1,
                "filename": require.resolve( "./argon2" ),
                "constructor": [],
            },
        } );
    }

    async authenticate ( token ) {
        // no token provided
        if ( token == null ) return new Auth( this.#app );

        var privateToken;

        console.log( await this.#app.threads.call( "argon2", "hash", "test" ) );

        // authenticate user / password
        if ( Array.isArray( token ) ) {
            // already private token
            if ( token.length === 3 ) {
                privateToken = token;
            }

            // TODO token is user / password
            else {
                // lowercase user name
                token[0] = token[0].toLowerCase();

                // generate private token hash
                const privateTokenHash = crypto
                    .createHash( "SHA3-512" )
                    .update( token[1] + token[0], "binary" )
                    .digest( "base64" );

                privateToken = [token[0], privateTokenHash, TOKEN_TYPE_PASSWORD];
            }
        }

        // authenticate token
        else {
        }

        // console.log( privateToken );

        return new Auth( this.#app, null, {
            "isAuthenticated": true,
            "userId": 199,
            "userName": "root",
            "groups": ["admin", "user"],
        } );
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 27:13         | no-unused-vars               | 'privateToken' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 54:14         | no-empty                     | Empty block statement.                                                         |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
