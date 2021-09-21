import "#lib/result";
import Events from "#lib/events";
import CLI from "#lib/app/cli";
import API from "#lib/app/api";
import RPC from "#lib/app/rpc";
import Cluster from "#lib/app/cluster";
import Notifications from "#lib/app/notifications";
import Server from "#lib/app/server";
import Threads from "#lib/threads";
import APIServices from "#lib/api/services";
import env from "#lib/env";

export default class App extends Events {
    #env;
    #api;
    #rpc;
    #services;
    #threads;
    #server;
    #cluster;
    #notifications;
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

        // init notifications
        this.#notifications = new Notifications( this );

        // init services
        this.#services = new APIServices();

        // init threads pool
        this.#threads = new Threads();
        this.#threads.on( "subscribe", name => this.#subscribe( name ) );
        this.#threads.on( "unsubscribe", name => this.#unsubscribe( name ) );
        this.#threads.on( "event", ( name, args ) => this.publish( name, ...args ) );

        // create public HTTP server
        this.#server = new Server();

        // subscribe on cluster from "api" events
        this.#server.once( "listening", () => {
            if ( this.#api && this.#cluster ) this.#cluster.subscribe( "api" );
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

    get notifications () {
        return this.#notifications;
    }

    get services () {
        return this.#services;
    }

    get server () {
        return this.#server;
    }

    // public
    async initCluster ( url ) {
        process.stdout.write( "Connecting to the cluster ... " );

        var res;

        if ( !url ) {
            res = result( [200, `Cluster not configured`] );
        }
        else {
            this.#cluster = new Cluster( url );

            await this.#cluster.waitConnect();

            // link events
            this.#cluster.on( "connect", () => this.#publishLocal( "cluster/connect" ) );
            this.#cluster.on( "disconnect", () => this.#publishLocal( "cluster/disconnect" ) );
            this.#cluster.on( "error", e => {
                console.log( "Cluster connection error", e );

                this.#publishLocal( "cluster/error", e );
            } );
            this.#cluster.on( "event", ( name, args ) => this.#publishLocal( "/" + name, args ) );

            res = result( 200 );
        }

        console.log( res + "" );

        return res;
    }

    async initServices ( options = {} ) {
        process.stdout.write( "Initialising services ... " );

        // add services
        if ( !options.services ) this.#services.addServicesFromEnv( options );
        else this.#services.addServices( options.services );

        var res;

        if ( !this.#services.num ) {
            res = result( [200, `No external services used`] );
        }
        else {
            res = result( 200 );
        }

        // link events
        this.#services.on( "connect", service => this.emit( `service/connect/${service}` ) );
        this.#services.on( "disconnect", service => this.emit( `service/disconnect/${service}` ) );
        this.#services.on( "event", ( service, name, args ) => this.emit( `service/event/${service}/${name}`, args ) );

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
        if ( this.#cluster ) this.#rpc.once( "listening", () => this.#cluster.subscribe( "rpc" ) );
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
            if ( this.#cluster ) {
                const globalName = name.substr( 1 ); // remove leading "/"

                this.#cluster.publish( globalName, ...args );
            }
        }

        // to the api users
        if ( name === "/api" || name === "api" ) {
            if ( this.#api ) this.#api.publish( ...args );
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
        if ( !this.#cluster ) return;

        // not a global event
        if ( name.charAt( 0 ) !== "/" ) return;

        this.#listeners[name] ??= 0;
        this.#listeners[name]++;

        if ( this.#listeners[name] === 1 ) this.#cluster.subscribe( name );
    }

    #unsubscribe ( name ) {
        if ( !this.#cluster ) return;

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
