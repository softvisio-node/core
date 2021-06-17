import "#index";
import Events from "#lib/events";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/api/rpc";
import Cluster from "#lib/app/cluster";
import Server from "#lib/http/server";
import Threads from "#lib/threads";
import env from "#lib/env";

export default class App extends Events {
    #env;
    #events;
    #threads;
    #server;
    #cluster;

    constructor ( options = {} ) {
        super();

        // set mode
        if ( process.cli && process.cli.options && process.cli.options.mode ) {
            env.mode = process.cli.options.mode;
        }

        // init environment
        this.env;

        // init events
        this.#events = new Events();

        this.#events.on( "subscribe", this.#onSubscribe.bind( this ) );
        this.#events.on( "unsubscribe", this.#onUnsubscribe.bind( this ) );

        // pipe app events
        this.#events.pipe( this );

        // init cluster
        this.#cluster = new Cluster();
        this.#cluster.on( "event", ( name, args ) => this.publish( name, ...args ) );
        this.#cluster.on( "connect", () => this.publish( "cluster/connect" ) );
        this.#cluster.on( "disconnect", () => this.publish( "cluster/disconnect" ) );

        // init threads pool
        this.#threads = new Threads();
        this.#threads.pipeEvents( this.#events );
        this.#threads.on( "event", ( name, args ) => this.publish( name, ...args ) );

        // create server
        this.#server = new Server();
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

    // XXX
    publish ( name, ...args ) {

        // forward global event to the cluster
        if ( name.startsWith( "/" ) ) {
            name = name.substr( 1 );

            this.#cluster.publish( name, ...args );
        }

        // to the api users
        if ( name === "api" ) {
            name = args.shift();
            const users = args.shift();

            const msg = JSON.stringify( {
                "jsonrpc": "2.0",
                "method": "/event",
                "params": [name, ...args],
            } );

            for ( const user of users ) {
                this.#server.publish( "users/" + user, msg, false );
            }
        }

        // to the rpc users
        else if ( name === "rpc" ) {

            // const msg = JSON.stringify( {
            //     "jsonrpc": "2.0",
            //     "method": "/event",
            //     "params": args,
            // } );
            // XXX
            // this.#server.publish( "users/*", msg, false );
        }

        // to the local and threads listeners
        else {
            this.#events.emit( name, ...args );
        }
    }

    // private
    #onSubscribe ( name ) {
        this.#cluster.subscribe( name );
    }

    #onUnsubscribe ( name ) {
        this.#cluster.unsubscribe( name );
    }
}
