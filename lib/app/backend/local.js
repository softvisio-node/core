const { mixin, mix } = require( "../../mixins" );
const res = require( "../../result" );
const crypto = require( "crypto" );
const { "v4": uuidv4 } = require( "uuid" );
const { Auth } = require( "../auth" );
const { AUTH_HASH, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );
const User = require( "./local/user" );

module.exports = mixin( ( Super ) =>
    class extends mix( User, Super ) {
        async doAuthenticatePrivate ( privateToken ) {
            if ( privateToken.type === TOKEN_TYPE_PASSWORD ) {
                return this.userPasswordAuthenticate( privateToken );
            }
            else if ( privateToken.type === TOKEN_TYPE_TOKEN ) {
                return this.tokenAuthenticate( privateToken );
            }
            else if ( privateToken.type === TOKEN_TYPE_SESSION ) {
                return this.sessionAuthenticate( privateToken );
            }
            else {
                return res( 400, "Invalid token type" );
            }
        }

        async _generatePasswordHash ( username, password ) {
            const privateTokenHash = crypto
                .createHash( AUTH_HASH )
                .update( password + username, "binary" )
                .digest( "base64" );

            return await this.app.threads.call( "argon2", "hash", privateTokenHash );
        }

        // TODO
        async _generateToken ( type ) {
            var id = uuidv4(),
                rand = crypto.randomBytes( 32 ).toString( "hex" ),
                privateTokenHash = crypto.createHash( AUTH_HASH ).update( rand, "binary" ).digest( "binary" );

            return {
                "id": id,
                "token": toB64u(),
                type,
                "hash": crypto.createHash( AUTH_HASH ).update( rand, "binary" ).digest( "binary" ),
            };

            //         my $token_id = uuid_v4;
            // my $rand = P->random->bytes(32);
            // my $token_bin = $token_id->bin . pack( 'C', $token_type ) . $rand;
            // my $private_token_hash = sha3_512_bin $rand;
            // return res 200,
            //   { id         => $token_id->str,
            //     token      => to_b64u $token_bin,
            //     token_type => $token_type,
            //     hash       => sha3_512_bin $token_type . $private_token_hash . $token_id->str,
            //   };
        }

        // TODO
        _returnAuth ( privateToken, userId, userName ) {
            return new Auth( this.app, privateToken, {
                "isAuthenticated": true,
                "userId": userId,
                "userName": userName,
                "groups": ["admin", "user"],
            } );
        }
    } );
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 39:17         | no-unused-vars               | 'privateTokenHash' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 43:26         | no-undef                     | 'toB64u' is not defined.                                                       |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
