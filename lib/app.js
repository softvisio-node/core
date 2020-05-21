const { mix } = require( "./mixins" );
const { readFileSync } = require( "./fs" );
const cli = require( "./cli" );
const Server = require( "./server" );
const Api = require( "./app/api" );
const Connection = require( "./app/connection" );
const EventEmitter = require( "events" );
const Auth = require( "./app/auth" );
const Threads = require( "./threads/pool" );

module.exports = class extends mix( Auth ) {
    devel = false;

    #connection;
    #emitter = new EventEmitter();
    #server;
    #api;
    #threads;
    #dbh;

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

    constructor ( options ) {
        if ( !options ) options = {};

        super( options );

        if ( process.cli ) {
            if ( process.cli.options.devel ) this.devel = process.cli.options.devel;

            if ( options.devel ) this.devel = options.devel;
        }
    }

    getConnection () {
        return this.#connection;
    }

    getApi () {
        return this.#api;
    }

    // TODO dbh
    async run () {
        this.#connection = new Connection( this );

        // init threads
        this.threads = new Threads( {
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );
        await this.runThreads( this.threads );

        this.#api = new Api( this );
        await this.initApi( this.#api );

        // TODO create handle
        this.#dbh = null;
        this.initDbh( this.#dbh );

        // init backend
        var Backend = require( "./app/backend" );
        this.backend = new Backend( this );
        await this.backend.init();

        this.#server = new Server( {} );
        await this.initLocations( this.#server );

        this.#server.listen( "0.0.0.0", 80, ( socket ) => {
            console.log( "Listening ..." );
        } );
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
            this.#server.emit( ...arguments );

            return;
        }

        // route to internal emitter
        this.#emitter.emit( ...arguments );
    }
};
