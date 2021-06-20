import "#index";
import Events from "#lib/events";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/api/rpc";
import Cluster from "#lib/app/cluster";
import Server from "#lib/app/server";
import Threads from "#lib/threads";
import env from "#lib/env";

export default class App extends Events {
    #env;
    #api;
    #rpc;
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
        this.env;

        // link app events
        this.on( "newListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            if ( this.listenerCount( "name" ) ) return;

            this.#subscribe( name );
        } );

        this.on( "removeListener", name => {
            if ( name === "removeListener" || name === "newListener" ) return;

            if ( this.listenerCount( "name" ) ) return;

            this.#unsubscribe( name );
        } );

        // init cluster
        this.#cluster = new Cluster();
        this.#cluster.on( "ready", () => this.#publishLocal( "cluster/ready" ) );
        this.#cluster.on( "disconnect", () => this.#publishLocal( "cluster/disconnect" ) );
        this.#cluster.on( "error", e => {
            console.log( "Cluster connection error", e );

            this.publish( "cluster/error", e );
        } );
        this.#cluster.on( "event", ( name, args ) => this.#publishLocal( "/" + name, args ) );

        // init threads pool
        this.#threads = new Threads();
        this.#threads.on( "subscribe", name => this.#subscribe( name ) );
        this.#threads.on( "unsubscribe", name => this.#unsubscribe( name ) );
        this.#threads.on( "event", ( name, args ) => this.publish( name, ...args ) );

        // create server
        this.#server = new Server();

        this.#server.on( "listening", () => {
            if ( this.#api ) this.#cluster.subscribe( "api" );
        } );

        this.#cluster.server.on( "listening", () => {
            if ( this.#rpc ) this.#cluster.subscribe( "rpc" );
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

    get api () {
        return this.#api;
    }

    get rpc () {
        return this.#rpc;
    }

    get env () {
        if ( !this.#env ) this.#env = env.readConfig();

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

    // public
    async initCluster ( options = {} ) {
        process.stdout.write( "Connecting to the cluster ... " );

        const res = await this.#cluster.init( options );

        console.log( res + "" );

        return res;
    }

    async createAPI ( API, backend, options ) {
        const api = new API( this, backend, options );

        // init api
        const res = await api._init( options );

        if ( res.ok ) this.#api = api;

        return res;
    }

    async createRPC ( RPC, options ) {
        const rpc = new RPC( this, options );

        // init api
        const res = await rpc._init( options );

        if ( res.ok ) this.#rpc = rpc;

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

        // to the rpc users
        else if ( name === "/rpc" || name === "rpc" ) {
            if ( this.cluster.server.numSubscribers( "*" ) ) {
                const msg = JSON.stringify( {
                    "jsonrpc": "2.0",
                    "method": "/event",
                    "params": args,
                } );

                this.cluster.server.publish( "*", msg, false );
            }
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
        this.#threads.publish( name, ...args );

        this.emit( name, ...args );
    }
}
