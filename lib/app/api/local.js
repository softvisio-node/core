const { mix } = require( "../../mixins" );
const result = require( "../../result" );
const sql = require( "../../sql" );
const crypto = require( "crypto" );
const { toBase58 } = require( "../../util" );
const { "parse": uuidParse, "v4": uuidv4 } = require( "uuid" );
const { ROOT_USER_NAME, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../../const" );

const EventEmitter = require( "events" );
const User = require( "./local/user" );
const UserActionToken = require( "./local/user-action-token" );
const UserObjectPermissions = require( "./local/user-object-permissions" );
const UserSession = require( "./local/user-session" );
const UserToken = require( "./local/user-token" );
const AppSettings = require( "./local/app-settings" );

const QUERIES = {
    "logApiCall": sql`INSERT INTO "api_calls_log" ("method_id", "user_id", "started", "delay", "is_error", "status", "reason") VALUES (?, ?, ?, ?, ?, ?, ?)`.prepare(),
};

module.exports = class extends mix( User, UserActionToken, UserObjectPermissions, UserSession, UserToken, AppSettings, EventEmitter ) {
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
    async init ( options = {} ) {

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
                "filename": __dirname + "/local/argon2",
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
        res = await this.createUser( ROOT_USER_NAME, password, true, this.app.env.root );
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

        if ( super.init ) return await super.init( options );

        return result( 200 );
    }

    // PROTECTED
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
        var id, tokenBuf, tokenStr;

        // api token
        if ( type === TOKEN_TYPE_TOKEN ) {
            id = uuidv4();
            tokenBuf = Buffer.concat( [crypto.randomBytes( 16 ), uuidParse( id )] );
            tokenStr = toBase58( tokenBuf );
        }

        // session token
        else if ( type === TOKEN_TYPE_SESSION ) {
            id = uuidv4();
            tokenBuf = Buffer.concat( [crypto.randomBytes( 32 ), uuidParse( id )] );
            tokenStr = tokenBuf.toString( "base64" );
        }

        // other tokens
        else {
            id = uuidv4();
            tokenBuf = Buffer.concat( [crypto.randomBytes( 16 ), uuidParse( id )] );
            tokenStr = toBase58( tokenBuf );
        }

        return {
            type,
            id,
            "token": type + tokenStr,
            "hash": this._getHash( tokenBuf ),
        };
    }

    async _logApiCall ( stat ) {
        this.dbh.do( QUERIES.logApiCall, [

            //
            stat.method_id,
            stat.user_id,
            stat.started.toISOString(),
            stat.delay,
            stat.is_error,
            stat.status,
            stat.reason,
        ] );
    }
};
