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

                // sync groups
                process.stdout.write( "Sync user groups ... " );
                res = await this._syncGroups( this.app.getGroups() );
                console.log( res + "" );

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

                // create root user
                process.stdout.write( "Creating root user ... " );
                const password = crypto.randomBytes( 32 ).toString( "hex" );
                res = this.userCreate( ROOT_USER_NAME, password, 1, null );
                console.log( res + ( res.isOk() ? ", password: " + password : "" ) );
            }

            async _syncGroups ( groups ) {
                let modified = 0;

                // insert groups
                let res = await this.dbh.do( sql`INSERT INTO "app_permission"`.VALUES( groups.map( ( group ) => {
                    return { "name": group };
                } ) )._`ON CONFLICT DO NOTHING` );

                if ( !res.isOk() ) return res;

                modified += res.rows;

                // enable groups
                res = await this.dbh.do( sql`UPDATE "app_permission" SET "enabled" = TRUE WHERE "enabled" = FALSE AND "name"`.IN( groups ) );

                if ( !res.isOk() ) return res;

                modified += res.rows;

                // disable removed groups
                res = await this.dbh.do( sql`UPDATE "app_permission" SET "enabled" = FALSE WHERE "enabled" = TRUE AND "name" NOT`.IN( groups ) );

                if ( !res.isOk() ) return res;

                modified += res.rows;

                if ( modified ) {
                    return result( 200 );
                }
                else {
                    return result( 204 );
                }
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
