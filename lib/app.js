require( "@softvisio/core" );
const Events = require( "events" );
const cli = require( "./cli" );
const Api = require( "./app/api" );
const Cluster = require( "./app/cluster" );
const server = require( "./http/server" );
const Threads = require( "./threads" );
const { toMsgPack } = require( "./msgpack" );
const env = require( "@softvisio/core/utils/env" );

module.exports = class extends Events {
    #devel = false;
    #env;
    #threads;
    #server;
    #cluster;

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

        // create cluster
        this.#cluster = new Cluster( {
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
        if ( !this.#env ) this.#env = env.read( { "mode": this.devel ? "development" : "production" } );

        return this.#env;
    }

    get threads () {
        return this.#threads;
    }

    get cluster () {
        return this.#cluster;
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
