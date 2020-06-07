const { mix } = require( "../../mixins" );
const result = require( "../../result" );
const sql = require( "../../sql" );
const crypto = require( "crypto" );
const { bytesToUuid, toBase64u } = require( "../../util" );
const { ROOT_USER_NAME, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );

const User = require( "./local/user" );
const UserActionToken = require( "./local/user-action-token" );
const UserObjectPermissions = require( "./local/user-object-permissions" );
const UserSession = require( "./local/user-session" );
const UserToken = require( "./local/user-token" );

module.exports = class extends mix( User, UserActionToken, UserObjectPermissions, UserSession, UserToken ) {
    #app;
    dbh;

    constructor ( app, dbh ) {
        super( app, dbh );

        this.#app = app;

        this.dbh = typeof dbh === "string" ? sql.connect( dbh ) : dbh;
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
        res = await this.#app.threads.run( {
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
        const user = await this.createUser( ROOT_USER_NAME, null, true, null );
        console.log( user + ( user.isOk() ? ", password: " + user.data.password : "" ) );
        if ( !user.isOk() && user.status !== 409 ) process.exit( 3 );

        return result( 200 );
    }

    async authenticatePrivate ( privateToken ) {
        if ( privateToken.type === TOKEN_TYPE_PASSWORD ) {
            return this.authenticateUserPassword( privateToken );
        }
        else if ( privateToken.type === TOKEN_TYPE_TOKEN ) {
            return this.authenticateUserToken( privateToken );
        }
        else if ( privateToken.type === TOKEN_TYPE_SESSION ) {
            return this.authenticateUserSession( privateToken );
        }
        else {
            return;
        }
    }

    generateToken ( type ) {
        const token = crypto.randomBytes( 33 );

        token[16] = type;

        return {
            "type": type,
            "id": bytesToUuid( token ),
            "token": toBase64u( token ),
            "hash": this.getHash( token ),
        };
    }
};
