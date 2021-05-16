import "#index";
import Events, { parseGroup } from "#lib/events";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/rpc";
import Cluster from "#lib/app/cluster";
import Server from "#lib/http/server";
import Threads from "#lib/threads";
import MSGPACK from "#lib/msgpack";
import env from "#lib/env";

export default class App extends Events {
    #env;
    #threads;
    #server;
    #cluster;

    static get CLI () {
        return CLI;
    }

    constructor ( options = {} ) {
        super();

        // set mode
        if ( process.cli && process.cli.options && process.cli.options.mode ) {
            env.mode = process.cli.options.mode;
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

    // props
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

    // EVENTS
    publish ( name, ...args ) {
        const event = parseGroup( name, args );

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
        const event = parseGroup( name, args );

        if ( event.group === "users" ) {
            this.#publishUsersEvent( event );
        }
        else {
            this.publish( event );
        }
    }

    #publishUsersEvent ( event ) {
        const msg = MSGPACK.encode( {
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
}
