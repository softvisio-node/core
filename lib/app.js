import "#index";
import Events from "#lib/events";
import EventsHub from "#lib/events/hub";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/api/rpc";
import Cluster from "#lib/app/cluster";
import Server from "#lib/http/server";
import Threads from "#lib/threads";
import env from "#lib/env";

export default class App extends Events {
    #env;
    #eventsHub;
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
        this.#eventsHub = new EventsHub();

        this.#eventsHub.on( "subscribe", this.#onSubscribe.bind( this ) );
        this.#eventsHub.on( "unsubscribe", this.#onUnsubscribe.bind( this ) );

        // pipe app events
        this.#eventsHub.pipe( this );

        // init cluster
        this.#cluster = new Cluster();
        this.#cluster.on( "event", ( name, params ) => this.publish( name, ...params ) );
        this.#cluster.on( "connect", () => this.publish( "cluster/connect" ) );
        this.#cluster.on( "disconnect", () => this.publish( "cluster/disconnect" ) );

        // init threads pool
        this.#threads = new Threads();
        this.#threads.pipeEventsHub( this.#eventsHub );
        this.#threads.on( "event", ( name, params ) => this.publish( name, ...params ) );

        // create server
        this.#server = new Server();

        // subscribe for "users" event
        this.on( "users", ( users, name, ...args ) => {
            const msg = JSON.stringify( {
                "jsonrpc": "2.0",
                "method": "/event",
                "params": [name, ...args],
            } );

            for ( const user of users ) {
                this.#server.publish( "users/" + user, msg, false );
            }
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

    // events
    publish ( name, ...params ) {
        if ( name.startsWith( "/" ) ) {
            name = name.substr( 1 );

            this.#cluster.publish( name, ...params );
        }

        this.#eventsHub.emit( name, ...params );
    }

    // private
    #onSubscribe ( name ) {
        this.#cluster.subscribe( name );
    }

    #onUnsubscribe ( name ) {
        this.#cluster.unsubscribe( name );
    }
}
