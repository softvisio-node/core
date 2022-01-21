import "#lib/result";
import EventsHub from "#lib/events/hub";
import Cli from "#lib/app/cli";
import Api from "#lib/app/api";
import Rpc from "#lib/app/rpc";
import Cluster from "#lib/app/cluster";
import Notifications from "#lib/app/notifications";
import Server from "#lib/http/server";
import Threads from "#lib/threads";
import ApiServices from "#lib/api/services";
import env from "#lib/env";
import mergeConst from "#lib/app/const";
import sql from "#lib/sql";

export default class App {
    #location;
    #const;
    #env;
    #hub = new EventsHub();
    #dbh;
    #api;
    #rpc;
    #services;
    #threads;
    #publicHttpServer;
    #privateHttpServer;
    #cluster;
    #notifications;
    #listeners = {};

    constructor ( location, _const ) {
        this.#location = location;
        this.#const = mergeConst( _const );

        // set mode
        if ( process?.cli?.options.mode ) env.mode = process.cli.options.mode;

        // init environment
        this.#env = env.readConfig();

        // init services
        this.#services = new ApiServices();

        // init threads pool
        this.#threads = new Threads();

        // link threads events
        this.#threads.hub.link( this.#hub, {
            "recvOnListen": { "out": "local" },
        } );

        this.#threads.hub.forward( "in", ( name, args ) => this.publish( name, ...args ) );
    }

    // static
    static get Cli () {
        return Cli;
    }

    // properties
    get const () {
        return this.#const;
    }

    get Api () {
        return Api;
    }

    get Rpc () {
        return Rpc;
    }

    get env () {
        return this.#env;
    }

    get hub () {
        return this.#hub;
    }

    get dbh () {
        return this.#dbh;
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

    // public
    async run () {

        // signal handlers
        process.on( "SIGINT", () => this._terminate() );

        process.on( "SIGTERM", () => this._terminate() );

        // init services
        var res = await this._initServices();
        if ( !res.ok ) return res;

        // init cluster
        res = await this._initCluster( process.env.APP_CLUSTER_ID, this.services.get( "core" ) );
        if ( !res.ok ) return res;

        // create dbh
        if ( process.env.APP_DB ) this.#dbh = await sql.new( process.env.APP_DB );

        const apiEnabled = this.#dbh && this.const.apiEnabled,
            rpcEnabled = this.const.rpcEnabled,
            notificationsEnabled = apiEnabled,
            privateHttpServerEnabled = this.const.privateHttpServerEnabled || ( rpcEnabled && this.const.privateHttpServerEnabled !== false ),
            publicHttpServerEnabled = this.const.publicHttpServerEnabled || ( apiEnabled && this.const.publicHttpServerEnabled !== false );

        // create API
        if ( apiEnabled ) {
            res = await this._createApi( this.Api, this.#dbh, {
                "dbSchema": new URL( "./db", this.#location ),
                "apiSchema": new URL( "./api", this.#location ),
            } );
            if ( !res.ok ) return res;
        }

        // init notifications
        if ( notificationsEnabled ) {
            res = await this._createNotifications();
            if ( !res.ok ) return res;
        }

        // create RPC
        if ( rpcEnabled ) {
            res = await this._createRpc( this.Rpc, {
                "apiSchema": new URL( "./rpc", this.#location ),
            } );
            if ( !res.ok ) return res;
        }

        // run threads
        const threadsConfig = this._initThreads();
        if ( threadsConfig ) {
            process.stdout.write( "Starting threads ... " );
            res = await this.threads.run( threadsConfig );
            console.log( res + "" );
            if ( !res.ok ) return res;
        }

        // init private HTTP server
        if ( privateHttpServerEnabled ) {
            this.#privateHttpServer = new Server();

            this._initPrivateHttpServer( this.#privateHttpServer );

            if ( rpcEnabled ) this.#privateHttpServer.api( "/api", this.rpc );
        }

        // init public HTTP server
        if ( publicHttpServerEnabled ) {
            this.#publicHttpServer = new Server();

            this._initPublicHttpServer( this.#publicHttpServer );

            if ( apiEnabled ) this.#publicHttpServer.api( "/api", this.api );
        }

        // start private HTTP server
        if ( this.#privateHttpServer ) {
            const port = this.#publicHttpServer ? 81 : 80;

            process.stdout.write( `Starting private HTTP server ... ` );

            res = await this.#privateHttpServer.listen( "0.0.0.0", port );

            if ( res.ok ) console.log( `listening on 0.0.0.0:${port}` );
            else console.log( `unable bind to the 0.0.0.0:${port}` );

            if ( !res.ok ) return res;

            if ( this.#cluster && this.#rpc ) this.#cluster.subscribe( "rpc" );
        }

        // start public HTTP server
        if ( this.#publicHttpServer ) {
            process.stdout.write( `Starting public HTTP server ... ` );

            res = await this.#publicHttpServer.listen( "0.0.0.0", 80 );

            if ( res.ok ) console.log( `listening on 0.0.0.0:80` );
            else console.log( `unable bind to the 0.0.0.0:80` );

            if ( !res.ok ) return res;

            if ( this.#cluster && this.#api ) this.#cluster.subscribe( "api" );
        }

        // run notifications
        if ( notificationsEnabled ) {
            res = await this.notifications.run();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    // events
    on ( name, listener ) {
        this.#hub.on( ...this.#parseEventName( name ), listener );
    }

    once ( name, listener ) {
        this.#hub.once( ...this.#parseEventName( name ), listener );
    }

    off ( name, listener ) {
        this.#hub.off( ...this.#parseEventName( name ), listener );
    }

    // XXX
    publish ( name, ...args ) {

        // api, targets, name, ...args
        if ( name === "api" ) {
            let targets = args.shift();
            const name = args[0];

            if ( !Array.isArray( targets ) ) targets = [targets];

            const cache = {},
                msg = {
                    "jsonrpc": "2.0",
                    "method": "/publish",
                    "params": args,
                };

            for ( const target of targets ) {
                this.#hub.publish( "api/out", target + "/" + name, [msg, cache] );
                this.#hub.publish( "global/out", target + "/" + name, [msg, cache] );
            }
        }
        else if ( name === "rpc" ) {
            const name = args[0];

            const cache = {},
                msg = {
                    "jsonrpc": "2.0",
                    "method": "/publish",
                    "params": args,
                };

            this.#hub.publish( "rpc/out", "*/" + name, [msg, cache] );
            this.#hub.publish( "global/out", "*/" + name, [msg, cache] );
        }
        else if ( name.startsWith( "/" ) ) {
            this.#hub.publish( "local", name, args );
            this.#hub.publish( "global", name, args );
        }
        else {
            this.#hub.publish( "local", name, args );
        }
    }

    // protected
    async _initServices ( options = {} ) {
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

        console.log( res + "" );

        return res;
    }

    // XXX link events
    async _initCluster ( namespace, api ) {
        process.stdout.write( "Connecting to the cluster ... " );

        var res;

        if ( !namespace || !api ) {
            res = result( [200, `Cluster is not configured`] );
        }
        else {
            this.#cluster = new Cluster( namespace, api );

            await this.#cluster.waitConnect();

            // link events
            // this.#cluster.on( "connect", () => this.#publishLocal( "cluster/connect" ) );
            // this.#cluster.on( "disconnect", () => this.#publishLocal( "cluster/disconnect" ) );
            // this.#cluster.on( "event", ( name, args ) => this.#publishLocal( "/" + name, args ) );

            res = result( 200 );
        }

        console.log( res + "" );

        return res;
    }

    async _createNotifications () {
        if ( this.#notifications ) throw Error( `Notifications instance already created` );

        // init notifications
        this.#notifications = new Notifications( this );

        return result( 200 );
    }

    async _createApi ( Api, backend, options ) {
        if ( this.#api ) throw Error( `API instance already created` );

        const api = new Api( this, backend, options );

        // init api
        const res = await api._new( options );

        if ( !res.ok ) return res;

        this.#api = api;

        return res;
    }

    async _createRpc ( Rpc, options ) {
        if ( this.#rpc ) throw Error( `RPC instance alrready created` );

        const rpc = new Rpc( this, options );

        // init api
        const res = await rpc._new( options );

        if ( !res.ok ) return res;

        this.#rpc = rpc;

        return res;
    }

    _initThreads () {}

    _initPrivateHttpServer ( server ) {}

    _initPublicHttpServer ( server ) {}

    _terminate () {
        console.log( "Terminated" );

        process.exit();
    }

    // private
    #parseEventName ( name ) {
        if ( name.startsWith( "api/" ) ) return ["api/in", name.substring( 4 )];
        else if ( name.startsWith( "rpc/" ) ) return ["rpc/in", name.substring( 4 )];
        else if ( name.startsWith( "service/" ) ) return ["service/in", name.substring( 8 )];
        else if ( name.startsWith( "/" ) ) return ["global/in", name];
        else return ["local", name];
    }
}
