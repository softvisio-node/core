const { IS_APP, ROOT_USER_NAME, ROOT_USER_ID } = require( "./const" );
const { readFileSync } = require( "./fs" );
const cli = require( "./cli" );
const Server = require( "./server" );
const EventEmitter = require( "events" );
const Threads = require( "./threads/pool" );
const result = require( "./result" );

module.exports = class {
    static [IS_APP] = true;

    devel = false;
    threads;
    server;

    #emitter = new EventEmitter();

    static runCli () {
        var spec = this.cli ? this.cli() : {};

        spec.options.devel = {
            "summary": "run app in development mode",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        cli( spec );
    }

    static loadEnv ( devel, options ) {
        if ( !options ) options = {};
        if ( !options.path ) options.path = "./";
        if ( !options.name ) options.name = ".env";
        if ( options.ext == null ) options.ext = ".config";

        var load = function ( file ) {
            file = options.path + "/" + options.name + file + options.ext;

            try {
                var data = readFileSync( file, "utf8" );
            }
            catch ( e ) {
                return;
            }

            for ( let line of data.split( "\n" ) ) {
                line = line.trim();

                if ( !line ) continue;

                const index = line.indexOf( "=" );

                if ( index > 0 ) {
                    const name = line.substr( 0, index ).toUpperCase().trim();

                    const value = line.substr( index + 1 ).trim();

                    if ( name.indexOf( "APP_" ) !== 0 ) continue;

                    process.env[name] = value;
                }
            }
        };

        load( "" );
        load( ".local" );

        if ( devel ) {
            load( ".devel" );
            load( ".devel.local" );
        }
        else {
            load( ".prod" );
            load( ".prod.local" );
        }
    }

    // TODO options as object this.#options
    constructor ( options ) {
        if ( !options ) options = {};

        if ( process.cli ) {
            if ( process.cli.options.devel ) this.devel = process.cli.options.devel;

            if ( options.devel ) this.devel = options.devel;
        }

        this.threads = new Threads( {
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );

        this.server = new Server( {} );
    }

    // EVENTS
    on () {
        this.#emitter.on( ...arguments );
    }

    once () {
        this.#emitter.once( ...arguments );
    }

    off () {
        this.#emitter.off( ...arguments );
    }

    emit ( name ) {

        // route "app/" event to threads
        if ( name.substr( 0, 4 ) === "app/" ) {
            this.threads.emit( ...arguments );
        }

        // route "client/" event
        else if ( name.substr( 0, 7 ) === "client/" ) {
            this.server.emit( ...arguments );

            return;
        }

        // route to internal emitter
        this.#emitter.emit( ...arguments );
    }

    // VALIDATORS
    userIsRoot ( userId ) {
        return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
    }

    validatePassword ( password ) {
        if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
    validateUserName ( userName ) {

        // check length
        if ( userName.length < 3 || userName.length > 32 ) return result( [400, "User name length must be between 3 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_@.-]/i.test( userName ) ) return result( [400, `User name must contain letters, digits, "_", "@", ".", "-" characters only`] );

        // digits only
        if ( /^\d+$/.test( userName ) ) return result( [400, "User name should not contain digits only"] );

        // looks like uuid
        if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( userName ) ) return result( [400, "User name should not look like UUID"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-32 characters
    validateTelegramUserName ( userName ) {

        // check length
        if ( userName.length < 5 || userName.length > 32 ) return result( [400, "Telegram user name length must be between 5 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_]/i.test( userName ) ) return result( [400, `Telegram user name must contain letters, digits and "_" only`] );

        return result( 200 );
    }

    validateEmail ( email ) {
        if ( !/^[a-z\d][a-z\d._-]+[a-z\d]@[a-z\d.-]+$/i.test( email ) ) return result( [400, "Email is invalid"] );

        return result( 200 );
    }
};
