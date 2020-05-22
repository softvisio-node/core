const { mixin, mix } = require( "../../mixins" );
const res = require( "../../result" );
const crypto = require( "crypto" );
const { bytesToUuid, toBase64u } = require( "../../util" );
const { Auth } = require( "../auth" );
const { TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );
const User = require( "./local/user" );

module.exports = mixin( ( Super ) =>
    class extends mix( User, Super ) {
        async init () {
            await this.app.runThreads( {
                "argon2": {
                    "num": 1,
                    "filename": require.resolve( "./local/argon2" ),
                    "constructor": [],
                },
            } );
        }

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
            return await this.app.rpc( "argon2", "hash", this._getHash( password + username ) );
        }

        async _generateToken ( type ) {
            const token = crypto.randomBytes( 33 );

            token[16] = type;

            return {
                "type": type,
                "id": bytesToUuid( token ),
                "token": toBase64u( token ),
                "hash": this._getHash( token ),
            };
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
