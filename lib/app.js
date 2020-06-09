const { IS_APP } = require( "./const" );
const { readFileSync } = require( "./fs" );
const EventEmitter = require( "events" );
const cli = require( "./cli" );
const Server = require( "./server" );
const Threads = require( "./threads/pool" );

module.exports = class extends EventEmitter {
    static [IS_APP] = true;

    devel = false;
    threads;
    server;

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

    // TODO threads on event
    constructor ( options = {} ) {
        super();

        // set devel option
        if ( Object.prototype.hasOwnProperty.call( options, "devel" ) ) {
            this.devel = options.devel;
        }
        else if ( process.cli && process.cli.options && Object.prototype.hasOwnProperty.call( process.cli.options, "devel" ) ) {
            this.devel = process.cli.options.devel;
        }

        // create threads pool
        this.threads = new Threads( {
            "eventNamePrefix": false,
            "onEvent": ( name, ...args ) => {
                if ( name.substr( 0, 4 ) ) throw Error( `Events "app/*" from worker are forbidden` );

                this.emit( name, ...args );
            },
        } );

        // create server
        this.server = new Server( {} );
    }

    // EVENTS
    emit ( name ) {

        // route "app/" event to threads
        if ( name.substr( 0, 4 ) === "app/" ) {
            return this.threads.emit( ...arguments );
        }

        // route "client/" event
        else if ( name.substr( 0, 7 ) === "client/" ) {
            return this.server.emit( ...arguments );
        }

        // route to internal emitter
        return super.emit( ...arguments );
    }
};
