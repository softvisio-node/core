const { IS_APP } = require( "./const" );
const { readFileSync } = require( "./fs" );
const EventEmitter = require( "events" );
const cli = require( "./cli" );
const Server = require( "./server" );
const Threads = require( "./threads/pool" );
const { toMessagePack } = require( "./util" );

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
        if ( options.ext == null ) options.ext = ".cfg";

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
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );

        // create server
        this.server = new Server( {} );
    }

    // EVENTS
    emit ( name, ...args ) {
        let sent = false;

        // route "app/" events to all threads
        if ( name.substr( 0, 4 ) === "app/" ) {
            sent = this.threads.emit( "*/" + name, ...args );
        }

        // route "users/" events to server only
        else if ( name.substr( 0, 6 ) === "users/" ) {
            const index = name.indexOf( "/", 6 );

            const route = name.substr( 0, index );
            name = name.substr( index + 1 );

            this.server.publish( route,
                toMessagePack( {
                    "type": "event",
                    name,
                    args,
                } ),
                true );

            return true;
        }

        // route "threads/" events to threads pool only
        else if ( name.substr( 0, 8 ) === "threads/" ) {
            name = name.substr( 8 );

            return this.threads.emit( name, ...args );
        }

        // route to internal emitter
        return sent && super.emit( name, ...args );
    }
};
