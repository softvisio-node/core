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
            "onEvent": ( name, args ) => this.publish( name, ...args ),
        } );

        // create cluster
        this.#cluster = new Cluster( {
            "eventNamePrefix": false,
            "onEvent": this.#onClusterEvent.bind( this ),
        } );

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
        if ( name.startsWith( ":" ) ) {
            const idx = name.indexOf( "/" );
            const group = name.substring( 1, idx );
            name = name.substr( idx + 1 );

            // :local
            if ( group === "local" ) {
                this.emit( name, ...args );
                this.threads.publish( name, ...args ); // to all threads
            }

            // :users
            else if ( group.startsWith( "users" ) ) {
                this.#publishUsersEvent( ":" + group + "/" + name, args );

                const groupAlias = process.env["APP_CLUSTER_GROUP_API"];
                if ( groupAlias ) this.cluster.publish( `:${groupAlias}:${group}/` + name, ...args );

                this.cluster.publish( ":" + group + "/" + name, ...args );
            }

            // :app
            else if ( group.startsWith( "app" ) ) {
                this.emit( name, ...args );
                this.threads.publish( name, ...args ); // to all threads

                const groupAlias = process.env["APP_CLUSTER_GROUP_APP"];
                if ( groupAlias ) this.cluster.publish( `:${groupAlias}/` + name, ...args );
            }

            // :api
            else if ( group.startsWith( "api" ) ) {
                this.emit( name, ...args );

                const groupAlias = process.env["APP_CLUSTER_GROUP_API"];
                if ( groupAlias ) this.cluster.publish( `:${groupAlias}/` + name, ...args );
            }

            // :threads
            else if ( group.startsWith( "threads" ) ) {
                if ( group.length > 7 ) return this.threads.publish( group.substr( 7 ) + "/" + name, ...args );
                else return this.threads.publish( name, ...args );
            }

            // custom group
            else {
                const groupAlias = process.env["APP_CLUSTER_GROUP_" + group.toUpperCase()];

                if ( groupAlias ) {
                    this.cluster.publish( `:${groupAlias}/` + name, ...args );

                    return true;
                }
                else {
                    return false;
                }
            }
        }
        else {
            return this.emit( name, ...args );
        }
    }

    // XXX
    #onClusterEvent ( name, args ) {
        if ( name.startsWith( "#users/" ) ) {
            this.#publishUsersEvent( name, args );
        }
        else this.publish( name, ...args );
    }

    // :users/event
    // :users:root,1,admin,@,!/name
    #publishUsersEvent ( name, args ) {
        var targets;

        if ( name.startsWith( ":users:" ) ) {
            const idx = name.indexOf( "/" );
            targets = name.substring( 7, idx );
            name = name.substr( idx + 1 );
        }
        else {
            name = name.substr( 7 ); // remove ":users/" prefix
        }

        const msg = toMsgPack( {
            "type": "event",
            name,
            args,
        } );

        // to all users
        if ( !targets ) this.#server.publish( ":users:*", msg, true );

        // to specific users
        for ( const target of targets.split( "," ) ) {
            if ( !target ) continue;

            this.#server.publish( ":users:" + target, msg, true );
        }
    }
};
