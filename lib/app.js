import "#index";
import Events from "#lib/events";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/api/rpc";
import Cluster from "#lib/app/cluster";
import Server from "#lib/app/server";
import Threads from "#lib/threads";
import env from "#lib/env";
import APIHub from "#lib/api/hub";

export default class App extends Events {
    #env;
    #api;
    #rpc;
    #services;
    #threads;
    #server;
    #cluster;
    #listeners = {};

    constructor ( options = {} ) {
        super();

        // set mode
        if ( process.cli && process.cli.options && process.cli.options.mode ) {
            env.mode = process.cli.options.mode;
        }

        // init environment
        this.#env = env.readConfig();

        // link app events
        this.on( "newListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            // already subscribed
            if ( this.listenerCount( "name" ) ) return;

            this.#subscribe( name );
        } );

        this.on( "removeListener", name => {
            if ( name === "removeListener" || name === "newListener" ) return;

            // not unsubscribed
            if ( this.listenerCount( "name" ) ) return;

            this.#unsubscribe( name );
        } );

        // init cluster
        this.#cluster = new Cluster();

        // init services
        this.#services = new APIHub();

        // init threads pool
        this.#threads = new Threads();
        this.#threads.on( "subscribe", name => this.#subscribe( name ) );
        this.#threads.on( "unsubscribe", name => this.#unsubscribe( name ) );
        this.#threads.on( "event", ( name, args ) => this.publish( name, ...args ) );

        // create public HTTP server
        this.#server = new Server();

        // subscribe on cluster from "api" events
        this.#server.on( "listening", () => {
            if ( this.#api ) this.#cluster.subscribe( "api" );
        } );
    }

    // static
    static get CLI () {
        return CLI;
    }

    // properties
    get API () {
        return API;
    }

    get RPC () {
        return RPC;
    }

    get env () {
        return this.#env;
    }

    get api () {
        return this.#api;
    }

    get rpc () {
        return this.#rpc;
    }

    get threads () {
        return this.#threads;
    }

    get cluster () {
        return this.#cluster;
    }

    get services () {
        return this.#services;
    }

    get server () {
        return this.#server;
    }

    // public
    async initCluster ( options = {} ) {
        process.stdout.write( "Connecting to the cluster ... " );

        const res = await this.#cluster.init( options );

        console.log( res + "" );

        if ( !res.ok ) return res;

        // link events
        this.#cluster.on( "ready", () => this.#publishLocal( "cluster/ready" ) );
        this.#cluster.on( "disconnect", () => this.#publishLocal( "cluster/disconnect" ) );
        this.#cluster.on( "error", e => {
            console.log( "Cluster connection error", e );

            this.#publishLocal( "cluster/error", e );
        } );
        this.#cluster.on( "event", ( name, args ) => this.#publishLocal( "/" + name, args ) );

        return res;
    }

    // XXX link services events
    async initServices ( services ) {
        process.stdout.write( "Initialising services ... " );

        // take services from environment
        if ( !services ) {
            services = Object.entries( process.env ).reduce( ( services, entry ) => {
                if ( entry[0].startsWith( "APP_SERVICE_" ) ) services[entry[0].substr( 12 )] = entry[1];

                return services;
            }, {} );
        }

        var res;

        if ( Object.isEmpty( services ) ) {
            res = result( [200, `No external services used`] );
        }
        else {
            this.#services.addServices( services );

            res = result( 200 );
        }

        console.log( res + "" );

        return res;
    }

    async createAPI ( API, backend, options ) {
        const api = new API( this, backend, options );

        // init api
        const res = await api._init( options );

        if ( !res.ok ) return res;

        this.#api = api;

        // link events
        this.#api.on( "ready", () => this.#publishLocal( "api/ready" ) );
        this.#api.on( "disconnect", () => this.#publishLocal( "api/disconnect" ) );
        this.#api.on( "settings-update", () => this.publish( "/api/settings-update" ) );
        this.#api.on( "event", ( name, auth, args ) => this.#publishLocal( "api/event/" + name, auth, args ) );

        return res;
    }

    async createRPC ( RPC, options ) {
        const rpc = new RPC( this, options );

        // init api
        const res = await rpc._init( options );

        if ( !res.ok ) return res;

        this.#rpc = rpc;

        // link events
        this.#rpc.on( "listening", () => this.#cluster.subscribe( "rpc" ) );
        this.#rpc.on( "event", ( name, args ) => this.#publishLocal( "rpc/event/" + name, args ) );

        return res;
    }

    async runThreads ( options ) {
        process.stdout.write( "Starting threads ... " );

        const res = await this.threads.run( options );

        console.log( res + "" );

        return res;
    }

    publish ( name, ...args ) {

        // forward global event to the cluster
        if ( name.startsWith( "/" ) ) {
            const globalName = name.substr( 1 ); // remove leading "/"

            this.#cluster.publish( globalName, ...args );
        }

        // to the api users
        if ( name === "/api" || name === "api" ) {
            if ( this.#api ) {
                name = args.shift();
                const users = args.shift();

                let msg;

                for ( const user of users ) {
                    if ( this.#server.numSubscribers( user ) ) {
                        if ( !msg ) {
                            msg = JSON.stringify( {
                                "jsonrpc": "2.0",
                                "method": "/event",
                                "params": [name, ...args],
                            } );
                        }

                        this.#server.publish( user, msg, false );
                    }
                }
            }
        }

        // to the rpc users
        else if ( name === "/rpc" || name === "rpc" ) {
            if ( this.#rpc ) this.#rpc.publish( ...args );
        }

        // to the services
        else if ( name === "/services" || name === "services" ) {
            this.services.publish( ...args );
        }

        // to the local and threads listeners
        else {
            this.#publishLocal( name, args );
        }
    }

    // private
    #subscribe ( name ) {

        // not a global event
        if ( name.charAt( 0 ) !== "/" ) return;

        this.#listeners[name] ??= 0;
        this.#listeners[name]++;

        if ( this.#listeners[name] === 1 ) this.#cluster.subscribe( name );
    }

    #unsubscribe ( name ) {

        // not a global event
        if ( name.charAt( 0 ) !== "/" ) return;

        if ( !this.#listeners[name] ) return;
        this.#listeners[name]--;

        if ( !this.#listeners[name] ) this.#cluster.unsubscribe( name );
    }

    #publishLocal ( name, args ) {
        if ( args ) {
            this.#threads.publish( name, ...args );
            this.emit( name, ...args );
        }
        else {
            this.#threads.publish( name );
            this.emit( name );
        }
    }
}
