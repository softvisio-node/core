const { IS_APP } = require( "./const" );
const { readFileSync } = require( "./fs" );
const cli = require( "./cli" );
const Server = require( "./server" );
const EventEmitter = require( "events" );
const Threads = require( "./threads/pool" );

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

    constructor ( options = {} ) {

        // set devel option
        if ( Object.prototype.hasOwnProperty.call( options, "devel" ) ) {
            this.devel = options.devel;
        }
        else if ( process.cli && process.cli.options && Object.prototype.hasOwnProperty.call( process.cli.options, "devel" ) ) {
            this.devel = process.cli.options.devel;
        }

        // create threads pool
        this.threads = new Threads( {
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );

        // create server
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
};
