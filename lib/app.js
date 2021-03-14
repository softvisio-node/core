require( "@softvisio/core" );
const Events = require( "events" );
const cli = require( "./cli" );
const fs = require( "@softvisio/core/fs" );
const Api = require( "./app/api" );
const server = require( "./http/server" );
const Threads = require( "./threads" );
const { toMsgPack } = require( "./msgpack" );

module.exports = class extends Events {
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
    get Api () {
        return Api;
    }

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

            // common env
            load( "" );
            load( ".local" );

            // development env
            if ( this.devel ) {
                load( ".development" );
                load( ".development.local" );
            }

            // production env
            else {
                load( ".production" );
                load( ".production.local" );
            }

            if ( this.#env.root && Object.isEmpty( this.#env.root ) ) delete this.#env.root;
            if ( this.#env.settings && Object.isEmpty( this.#env.settings ) ) delete this.#env.settings;

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

            const msg = toMsgPack( {
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
        return new Promise( resolve => {
            this.#server.listen( "0.0.0.0", 80, token => {
                if ( !token ) {
                    console.log( `Listening ... error listen 0.0.0.0:80` );

                    resolve( result( 500 ) );
                }
                else {
                    console.log( `Listening ... 0.0.0.0:80` );

                    resolve( result( 200 ) );
                }
            } );
        } );
    }
};
