const { mix } = require( "../../mixins" );
const result = require( "../../result" );
const sql = require( "../../sql" );
const { ROOT_USER_NAME, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );

const EventEmitter = require( "events" );
const UserPermissions = require( "./local/user-permissions" );
const User = require( "./local/user" );
const UserActionToken = require( "./local/user-action-token" );
const ObjectMixin = require( "./local/object" );
const UserSession = require( "./local/user-session" );
const UserToken = require( "./local/user-token" );
const AppSettings = require( "./local/app-settings" );
const ApiCallLog = require( "./local/api-call-log" );

module.exports = class extends mix( UserPermissions, User, UserActionToken, ObjectMixin, UserSession, UserToken, AppSettings, ApiCallLog, EventEmitter ) {
    #dbh;

    constructor ( dbh ) {
        if ( typeof dbh === "string" ) dbh = sql.connect( dbh );

        super( dbh );

        this.#dbh = dbh;
    }

    // GETTER
    get dbh () {
        return this.#dbh;
    }

    // PUBLIC
    async $init ( options = {} ) {

        // init db
        process.stdout.write( "Migrating API backend schema ... " );
        await this.#dbh.loadSchema( __dirname + "/local/db/" + ( this.#dbh.isSqlite ? "sqlite" : "pgsql" ), "api" );
        let res = await this.#dbh.migrate();
        console.log( res + "" );
        if ( !res.ok ) return res;

        // migrate db schema
        if ( options.schema ) {
            process.stdout.write( "Migrating DB schema ... " );
            await this.#dbh.loadSchema( options.schema );
            res = await this.#dbh.migrate();
            console.log( res + "" );
            if ( !res.ok ) return res;
        }

        // run threads
        process.stdout.write( "Starting argon2 thread ... " );
        res = await this.app.threads.run( {
            "argon2": {
                "num": 1,
                "path": __dirname + "/local/threads/argon2",
                "constructor": [],
            },
        } );
        console.log( res + "" );
        if ( !res.ok ) return res;

        // create root user
        let password;

        if ( this.app.env.root ) {

            // root password is defined in env
            if ( this.app.env.root.password != null && this.app.env.root.password !== "" ) password = this.app.env.root.password;

            delete this.app.env.root.password;
        }

        process.stdout.write( "Creating root user ... " );
        res = await this.createUser( ROOT_USER_NAME, password, true, null, this.app.env.root );
        console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : ' taken from ".env" file' ) : "" ) );

        // error creating root user
        if ( !res.ok ) {

            // error
            if ( res.status !== 409 ) {
                return res;
            }

            // root user already exists
            else if ( process.cli.options["reset-root"] ) {
                process.stdout.write( "Setting root password ... " );
                res = await this.setUserPassword( ROOT_USER_NAME, password );
                console.log( res + ( res.ok ? ", password" + ( password == null ? `: ${res.data.password}` : ' taken from ".env" file' ) : "" ) );
                process.exit();
            }
        }

        res = super.$init ? await super.$init( options ) : result( 200 );

        return res;
    }

    // PROTECTED
    async authenticate ( token ) {
        if ( token.type === TOKEN_TYPE_PASSWORD ) {
            return this._authenticateUserPassword( token );
        }
        else if ( token.type === TOKEN_TYPE_TOKEN ) {
            return this._authenticateUserToken( token );
        }
        else if ( token.type === TOKEN_TYPE_SESSION ) {
            return this._authenticateUserSession( token );
        }
        else {
            return;
        }
    }
};
