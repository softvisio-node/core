const { Auth } = require( "./auth" );
const crypto = require( "crypto" );
const { TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject } = require( "../util" );

module.exports = class {
    app;

    constructor ( app ) {
        this.app = app;
    }

    async init () {
        await this.app.threads.run( {
            "argon2": {
                "num": 1,
                "filename": require.resolve( "./argon2" ),
                "constructor": [],
            },
        } );
    }

    async authenticate ( token ) {
        // no token provided
        if ( token == null ) return new Auth( this.app );

        var privateToken;

        // already private token
        if ( isPlainObject( token ) ) {
            privateToken = token;
        }

        // authenticate user / password
        else if ( Array.isArray( token ) ) {
            // token is user / password
            // lowercase user name
            token[0] = token[0].toLowerCase();

            // generate private token hash
            const privateTokenHash = crypto
                .createHash( "SHA3-512" )
                .update( token[1] + token[0], "binary" )
                .digest( "base64" );

            privateToken = {
                "id": token[0],
                "type": TOKEN_TYPE_PASSWORD,
                "hash": privateTokenHash,
            };
        }

        // authenticate token
        else {
            privateToken = this._unpackToken( token );
        }

        return this.authenticatePrivate( privateToken );
    }

    // TODO
    _unpackToken ( token ) {
        //     my ( $token_id, $token_type, $private_token_hash );
        // # decode token
        // eval {
        //     my $token_bin = from_b64u $token;
        //     # unpack token id
        //     $token_id = uuid_from_bin( substr $token_bin, 0, 16 )->str;
        //     die if length $token_bin < 16;
        //     $token_type = unpack 'C', substr $token_bin, 16, 1;
        //     $private_token_hash = sha3_512_bin substr $token_bin, 17;
        // };
        // # error decoding token
        // return if $@;
        // return [ $token_id, $private_token_hash, $token_type ];
    }

    // TODO
    async authenticatePrivate ( privateToken ) {
        // console.log( await this.app.threads.call( "argon2", "hash", "test" ) );

        var auth = await this.doAuthenticatePrivate( privateToken );

        return auth;
    }
};
