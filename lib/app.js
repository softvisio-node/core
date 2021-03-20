require( "@softvisio/core" );
const Events = require( "events" );
const cli = require( "./cli" );
const Api = require( "./app/api" );
const Cluster = require( "./cluster" );
const Server = require( "./http/server" );
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
                if ( name.startsWith( "#users/" ) ) {
                    this.#publishUsersEvent( name, args );
                }
                else this.emit( name, ...args );
            },
        } );

        this.#cluster.on( "connect", () => this.emit( "#local/cluster/connect" ) );
        this.#cluster.on( "disconnect", () => this.emit( "#local/cluster/disconnect" ) );

        // create server
        this.#server = new Server();
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

        // route to all listeners
        if ( name.startsWith( "*/" ) ) {
            name = name.substr( 2 );

            super.emit( name, ...args );
            this.threads.emit( "*/" + name, ...args );
            this.cluster.emit( name, ...args );

            return true;
        }
        else if ( name.startsWith( "#" ) ) {
            const idx = name.indexOf( "/" ),
                scope = name.substring( 6, idx );

            name = name.substr( idx + 1 );

            if ( scope === "#local" ) {
                super.emit( name, ...args );
                this.threads.emit( "*/" + name, ...args );
            }
            else if ( scope === "#threads" ) {
                this.threads.emit( name, ...args );
            }
            else if ( scope === "#cluster" ) {
                this.cluster.emit( name, ...args );
            }
            else if ( scope === "#users" ) {
                this.cluster.emit( "#users/" + name, ...args );

                this.#publishUsersEvent( "#users/" + name, args );
            }
            else if ( scope === "#api" ) {
                super.emit( name, ...args );
                this.cluster.emit( name, ...args );
            }
            else {
                return false;
            }

            return true;
        }

        // route to internal listeners
        else {
            return super.emit( name, ...args );
        }
    }

    #publishUsersEvent ( name, args ) {
        const idx = name.indexOf( "/", 7 ),
            users = name.substring( 7, idx );

        name = name.substr( idx + 1 );

        const msg = toMsgPack( {
            "type": "event",
            name,
            args,
        } );

        for ( const user of users.split( "," ) ) {
            this.#server.publish( "#users/" + user, msg, true );
        }
    }
};
