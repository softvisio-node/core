require( "#index" );

const Events = require( "./events" );
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
        } );

        this.#threads.on( "event", ( name, args ) => this.publish( name, ...args ) );

        // create cluster
        this.#cluster = new Cluster( {
            "eventNamePrefix": false,
        } );

        this.#cluster.on( "event", this.#onClusterEvent.bind( this ) );
        this.#cluster.on( "connect", () => this.publish( ":local/cluster/connect" ) );
        this.#cluster.on( "disconnect", () => this.publish( ":local/cluster/disconnect" ) );

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
    publish ( name, ...args ) {
        const event = Events.parseGroup( name, args );

        if ( event.group ) {

            // :local
            if ( event.group === "local" ) {

                // to local emitter
                this.emit( event.name, ...event.args );

                // to all threads
                this.threads.publish( event );

                return true;
            }

            // :users
            else if ( event.group === "users" ) {

                // to cluster group
                if ( !this.cluster.publish( event ) ) return false;

                // to users
                return this.#publishUsersEvent( event );
            }

            // :threads
            else if ( event.group === "threads" ) {

                // to threads
                return this.threads.publish( event );
            }

            // custom group
            else {

                // to cluster group
                return this.cluster.publish( event );
            }
        }
        else {
            this.emit( event.name, ...event.args );

            return true;
        }
    }

    #onClusterEvent ( name, args ) {
        const event = Events.parseGroup( name, args );

        if ( event.group === "users" ) {
            this.#publishUsersEvent( event );
        }
        else {
            this.publish( event );
        }
    }

    #publishUsersEvent ( event ) {
        const msg = toMsgPack( {
            "type": "event",
            "name": event.name,
            "args": event.args,
        } );

        // to all users
        if ( !event.targets ) this.#server.publish( ":users:*", msg, true );

        // to specific users
        for ( const target of event.targets ) {
            this.#server.publish( ":users:" + target, msg, true );
        }

        return true;
    }
};
