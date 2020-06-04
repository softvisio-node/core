const { mixin, mix } = require( "../../mixins" );
const result = require( "../../result" );
const sql = require( "../../sql" );
const crypto = require( "crypto" );
const { bytesToUuid, toBase64u } = require( "../../util" );
const { Auth } = require( "../auth" );
const { ROOT_USER_NAME, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );
const User = require( "./local/user" );

module.exports = mixin( ( Super ) =>
    class extends mix( User, Super ) {
            dbh;

            constructor ( app ) {
                super( app );

                this.dbh = app.dbh;
            }

            // TODO
            async init () {

                // TODO init LRU hash cache

                // init db
                process.stdout.write( "Creating auth backend ... " );

                // TODO not works under yarn
                // await this.dbh.loadSchema( __dirname + "/local/db/" + ( this.dbh.isSqlite ? "sqlite" : "pgsql" ) );
                this.dbh.addSchemaPatch( 1, "api", require( "./local/db/" + ( this.dbh.isSqlite ? "sqlite" : "pgsql" ) ) );
                let res = await this.dbh.migrate();
                console.log( res + "" );
                if ( !res.isOk() ) process.exit( 3 );

                // run threads
                process.stdout.write( "Starting auth thread ... " );
                res = await this.app.runThreads( {
                    "argon2": {
                        "num": 1,
                        "filename": __dirname + "/local/argon2",
                        "constructor": [],
                    },
                } );
                console.log( res + "" );
                if ( !res.isOk() ) process.exit( 3 );

                // create root user
                process.stdout.write( "Creating root user ... " );
                const user = await this.userCreate( ROOT_USER_NAME, null, true, null );
                console.log( user + ( user.isOk() ? ", password: " + user.data.password : "" ) );
                if ( !user.isOk() ) process.exit( 3 );
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
                    return result( 400, "Invalid token type" );
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
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 3:7           | no-unused-vars               | 'sql' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
