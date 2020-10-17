const { IS_APP } = require( "./const" );
const { readFileSync } = require( "./fs" );
const EventEmitter = require( "events" );
const cli = require( "./cli" );
const server = require( "./http/server" );
const Threads = require( "./threads/pool" );
const { toMessagePack, getRandomFreePort } = require( "./util" );

module.exports = class extends EventEmitter {
    static [IS_APP] = true;

    #devel = false;
    #threads;
    #server;

    static runCli () {
        var spec = this.cli ? this.cli() : {};

        if ( !spec.options ) spec.options = {};

        spec.options.devel = {
            "summary": "Run app in development mode.",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-settings"] = {
            "short": false,
            "summary": `Apply application settings from the ".config.yaml".`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-root"] = {
            "short": false,
            "summary": `Set root password from the ".config.yaml".`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        cli( spec );
    }

    static loadEnv ( devel, options = {} ) {
        if ( !options.path ) options.path = "./";

        if ( !options.name ) options.prefix = ".env";

        if ( options.ext == null ) options.ext = "";

        var env = {};

        var load = function ( mode ) {
            const file = options.path + "/" + options.prefix + mode + options.ext;

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

                    let value = line.substr( index + 1 ).trim();

                    // single quotes
                    if ( value.charAt( 0 ) === "'" && value.charAt( value.length - 1 ) === "'" ) {

                        // dequote
                        value = value.substring( 1, value.length - 1 );
                    }

                    // double quotes
                    else if ( value.charAt( 0 ) === '"' && value.charAt( value.length - 1 ) === '"' ) {

                        // interpolate "\n"
                        value = value.replace( /\\n/g, "\n" );

                        // dequote
                        value = value.substring( 1, value.length - 1 );
                    }

                    // substitute variables
                    value = value.replace( /(?<!\\)\$\{?([a-zA-Z0-9_]+)\}?/g, ( match, name ) => {
                        if ( Object.hasOwnProperty.call( process.env, name ) ) {
                            return process.env[name];
                        }
                        else if ( Object.hasOwnProperty.call( env, name ) ) {
                            return env[name];
                        }
                        else {
                            return "";
                        }
                    } );

                    env[name] = value;
                }
            }
        };

        load( "" );

        if ( devel ) {
            load( ".development" );
        }
        else {
            load( ".production" );
        }

        // merge
        for ( const name in env ) {

            // add only "APP_" variables
            if ( name.indexOf( "APP_" ) !== 0 ) continue;

            // do not override
            if ( Object.hasOwnProperty.call( process.env, name ) ) continue;

            process.env[name] = env[name];
        }
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
                port = await getRandomFreePort( { host } );
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

        this.#server.listen( host, port, socket => {
            console.log( `Listening ... ${host}:${port}` );
        } );
    }

    // LOAD BALANCER
    _removeLoadBalancerConfig () {
        if ( !process.env.APP_LOADBALANCER_ID ) return;

        const nginx = require( "./nginx" );

        nginx.removeLoadBalancerConfig( process.env.APP_LOADBALANCER_ID );
    }
};
