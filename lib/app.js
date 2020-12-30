const { OBJECT_IS_APP } = require( "./const" );
const EventEmitter = require( "events" );
const cli = require( "./cli" );
const fs = require( "@softvisio/core/fs" );
const result = require( "./result" );
const Api = require( "./app/api" );
const server = require( "./http/server" );
const Threads = require( "./threads/pool" );
const { toMessagePack, getRandomFreePort, isEmptyObject } = require( "./util" );

module.exports = class extends EventEmitter {
    static [OBJECT_IS_APP] = true;

    #devel = false;
    #env;
    #threads;
    #server;

    static runCli () {
        var spec = this.cli ? this.cli() : {};

        if ( !spec.options ) spec.options = {};

        spec.options.devel = {
            "summary": "Run application in development mode.",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-settings"] = {
            "short": false,
            "summary": `Update application settings from the ".env" files and exit.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-root"] = {
            "short": false,
            "summary": `Set root password from the ".env" files and exit. If root password is not defined in environment it will be randomly generated.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        cli( spec );
    }

    constructor ( options = {} ) {
        super();

        // set devel option
        if ( Object.prototype.hasOwnProperty.call( options, "devel" ) ) {
            this.#devel = options.devel;
        }
        else if ( process.cli && process.cli.options && Object.prototype.hasOwnProperty.call( process.cli.options, "devel" ) ) {
            this.#devel = process.cli.options.devel;
        }

        // init environment
        this.env;

        // create threads pool
        this.#threads = new Threads( {
            "eventNamePrefix": false,
            "onEvent": ( name, args ) => {
                this.emit( name, ...args );
            },
        } );

        // create server
        this.#server = server( {} );
    }

    // PROPS
    get devel () {
        return this.#devel;
    }

    get env () {
        if ( !this.#env ) {
            this.#env = {};

            const tmp = {};

            const load = env => {
                const path = ".env" + env + ".yaml";

                if ( !fs.existsSync( path ) ) return;

                env = fs.config.read( path );

                // merge root
                if ( env.root ) this.#env.root = { ...( this.#env.root || {} ), ...env.root };

                // merge settings
                if ( env.settings ) this.#env.settings = { ...( this.#env.settings || {} ), ...env.settings };

                // merge env
                if ( env.env ) {
                    for ( const key in env.env ) {
                        let val = env.env[key];

                        // prepare value
                        if ( val == null ) val = "";
                        else val = val.trim();

                        // substitute variables
                        val = val.replace( /(?<!\\)\$\{?([a-zA-Z0-9_]+)\}?/g, ( match, key ) => {
                            key = key.toUpperCase();

                            if ( Object.hasOwnProperty.call( process.env, key ) ) return process.env[key];
                            else if ( Object.hasOwnProperty.call( tmp, key ) ) return tmp[key];
                            else return "";
                        } );

                        tmp[key.toUpperCase()] = val;
                    }
                }
            };

            load( "" );
            if ( this.devel ) load( ".development" );
            else load( ".production" );

            if ( this.#env.root && isEmptyObject( this.#env.root ) ) delete this.#env.root;
            if ( this.#env.settings && isEmptyObject( this.#env.settings ) ) delete this.#env.settings;

            // apply environment
            for ( const key in tmp ) {

                // must start with "APP_" prefix
                if ( key.indexOf( "APP_" ) !== 0 ) continue;

                // do not override
                if ( Object.hasOwnProperty.call( process.env, key ) ) continue;

                // add env variable
                process.env[key] = tmp[key];
            }
        }

        return this.#env;
    }

    get threads () {
        return this.#threads;
    }

    get server () {
        return this.#server;
    }

    // EVENTS
    emit ( name, ...args ) {
        let sent = false;

        // route "app/" events to all threads
        if ( name.substr( 0, 4 ) === "app/" ) {
            sent = this.#threads.emit( "*/" + name, ...args );
        }

        // route "users/" events to server only
        else if ( name.substr( 0, 6 ) === "users/" ) {
            const idx = name.indexOf( "/", 6 );

            const users = name.substring( 6, idx );

            name = name.substr( idx + 1 );

            const msg = toMessagePack( {
                "type": "event",
                name,
                args,
            } );

            for ( const user of users.split( "," ) ) {
                this.#server.publish( "users/" + user, msg, true );
            }

            return true;
        }

        // route "threads/" events to threads pool only
        else if ( name.substr( 0, 8 ) === "threads/" ) {
            name = name.substr( 8 );

            return this.#threads.emit( name, ...args );
        }

        // route to internal emitter
        return sent && super.emit( name, ...args );
    }

    // API
    async _buildApi ( backend, mixin, options = {} ) {
        const Api = this.#getApiClass( backend );

        var api;

        if ( mixin ) {
            api = new ( mixin( Api ) )( this, backend, options );
        }
        else {
            api = new Api( this, backend, options );
        }

        // init api
        var res = await api.$init( options );

        if ( !res.ok ) {
            console.log( "TERMINATED" );

            process.exit( 3 );
        }

        return api;
    }

    #getApiClass ( backend ) {
        var Super;

        // auth is not defined
        if ( !backend ) {
            Super = require( "./app/api/loopback" );
        }

        // auth is url
        else if ( typeof backend === "string" ) {
            const url = new URL( backend ),
                protocol = url.protocol.slice( 0, -1 );

            if ( protocol === "sqlite" ) {
                Super = require( "./app/api/local" );
            }
            else if ( protocol === "pgsql" ) {
                Super = require( "./app/api/local" );
            }
            else if ( protocol === "ws" || protocol === "wss" ) {
                Super = require( "./app/api/remote" );
            }
            else {
                throw `Invalid backend url "${backend}"`;
            }
        }

        // auth is dbh
        else {
            if ( backend.isSqlite ) {
                Super = require( "./app/api/local" );
            }
            else if ( backend.isPgsql ) {
                Super = require( "./app/api/local" );
            }
            else {
                throw "Backend object is not dbh";
            }
        }

        var Class = Api( Super );

        return Class;
    }

    // SERVER
    async _listen () {
        let host, port;

        // loadbalancer
        if ( process.env.APP_LOADBALANCER_ID && process.env.APP_LOADBALANCER_SERVER_NAME ) {
            host = "127.0.0.1";

            if ( process.env.APP_LOADBALANCER_PORT ) {
                port = process.env.APP_LOADBALANCER_PORT;
            }

            // random port
            else {
                port = await getRandomFreePort( host );
            }

            // install loadbalancer config
            require( "./nginx" ).installLoadBalancerConfig( process.env.APP_LOADBALANCER_ID, host, port, process.env.APP_LOADBALANCER_SERVER_NAME );

            console.log( `Installing load balancer config ... done` );
        }

        // direct
        else {
            host = "0.0.0.0";
            port = 80;
        }

        return new Promise( resolve => {
            this.#server.listen( host, port, token => {
                if ( !token ) {
                    console.log( `Listening ... error listen ${host}:${port}` );

                    resolve( result( 500 ) );
                }
                else {
                    console.log( `Listening ... ${host}:${port}` );

                    resolve( result( 200 ) );
                }
            } );
        } );
    }

    // LOAD BALANCER
    _removeLoadBalancerConfig () {
        if ( !process.env.APP_LOADBALANCER_ID ) return;

        const nginx = require( "./nginx" );

        nginx.removeLoadBalancerConfig( process.env.APP_LOADBALANCER_ID );
    }
};
