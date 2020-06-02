const { IS_APP } = require( "./const" );
const { mix } = require( "./mixins" );
const { readFileSync } = require( "./fs" );
const cli = require( "./cli" );
const Server = require( "./server" );
const sql = require( "./sql" );
const Api = require( "./app/api" );
const Connection = require( "./app/connection" );
const EventEmitter = require( "events" );
const Auth = require( "./app/auth" );
const Threads = require( "./threads/pool" );

module.exports = class extends mix( Auth ) {
    devel = false;

    #threads;
    backend;

    #connection;
    #emitter = new EventEmitter();
    #server;
    #api;
    #dbh;

    static [IS_APP] = true;

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

    async run () {
        this.#connection = new Connection( this );

        // init dbh
        if ( process.env.APP_DB ) {
            process.stdout.write( "Init database ... " );

            this.#dbh = sql.connect( process.env.APP_DB );

            const res = await this.initDbh( this.#dbh );

            console.log( res + "" );
        }

        // init threads
        this.#threads = new Threads( {
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );
        await this.initThreads();

        // init api
        this.#api = new Api( this );
        await this.initApi( this.#api );

        // init backend
        var Backend = require( "./app/backend/pgsql" );
        this.backend = new Backend( this );
        await this.backend.init();

        // init http server
        this.#server = new Server( {} );
        await this.initLocations( this.#server );

        // start listen
        this.#server.listen( "0.0.0.0", 80, ( socket ) => {
            console.log( "Listening ..." );
        } );
    }

    // THREADS
    runThreads ( options ) {
        this.#threads.run( options );
    }

    async rpc () {
        return this.#threads.call( ...arguments );
    }

    rpcVoid () {
        this.#threads.callVoid( ...arguments );
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
