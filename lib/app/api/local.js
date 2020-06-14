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
const AppSettings = require( "./local/app-settings" );

module.exports = class extends mix( User, UserActionToken, UserObjectPermissions, UserSession, UserToken, AppSettings ) {
    #app;
    #dbh;

    constructor ( app, dbh ) {
        if ( typeof dbh === "string" ) dbh = sql.connect( dbh );

        super( app, dbh );

        this.#app = app;
        this.#dbh = dbh;
    }

    async init () {

        // init db
        process.stdout.write( "Migrating API backend schema ... " );

        // TODO not works under yarn
        // await this.#dbh.loadSchema( __dirname + "/local/db/" + ( this.#dbh.isSqlite ? "sqlite" : "pgsql" ) );
        this.#dbh.addSchemaPatch( 1, "api", require( "./local/db/" + ( this.#dbh.isSqlite ? "sqlite" : "pgsql" ) ) );
        let res = await this.#dbh.migrate();
        console.log( res + "" );
        if ( !res.isOk() ) return res;

        // run threads
        process.stdout.write( "Starting argon2 thread ... " );
        res = await this.#app.threads.run( {
            "argon2": {
                "num": 1,
                "filename": __dirname + "/local/argon2",
                "constructor": [],
            },
        } );
        console.log( res + "" );
        if ( !res.isOk() ) return res;

        // create root user
        process.stdout.write( "Creating root user ... " );
        res = await this.createUser( ROOT_USER_NAME, null, true );
        console.log( res + ( res.isOk() ? ", password: " + res.data.password : "" ) );
        if ( !res.isOk() && res.status !== 409 ) return res;

        return result( 200 );
    }

    async _authenticatePrivate ( privateToken ) {
        if ( privateToken.type === TOKEN_TYPE_PASSWORD ) {
            return this._authenticateUserPassword( privateToken );
        }
        else if ( privateToken.type === TOKEN_TYPE_TOKEN ) {
            return this._authenticateUserToken( privateToken );
        }
        else if ( privateToken.type === TOKEN_TYPE_SESSION ) {
            return this._authenticateUserSession( privateToken );
        }
        else {
            return;
        }
    }

    _generateToken ( type ) {
        const token = crypto.randomBytes( 33 );

        token[16] = type;

        return {
            "type": type,
            "id": bytesToUuid( token ),
            "token": toBase64u( token ),
            "hash": this._getHash( token ),
        };
    }
};
