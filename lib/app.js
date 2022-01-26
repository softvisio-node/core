import "#lib/result";
import Events from "#lib/events";
import Cli from "#lib/app/cli";
import Api from "#lib/app/api";
import Rpc from "#lib/app/rpc";
import Cluster from "#lib/app/cluster";
import Notifications from "#lib/app/notifications";
import Server from "#lib/http/server";
import Threads from "#lib/threads";
import ApiServices from "#lib/api/services";
import env from "#lib/env";
import mergeConfig from "#lib/app/config";
import sql from "#lib/sql";

export default class App {
    #location;
    #config;
    #env;
    #events = new Events();
    #dbh;
    #api;
    #rpc;
    #services;
    #threads;
    #publicHttpServer;
    #privateHttpServer;
    #cluster;
    #notifications;

    constructor ( location, config ) {
        this.#location = location;
        this.#config = mergeConfig( config );

        // set mode
        if ( process?.cli?.options.mode ) env.mode = process.cli.options.mode;

        // init environment
        this.#env = env.readConfig();

        // init services
        this.#services = new ApiServices();

        // init threads
        this.#threads = new Threads();

        // forward subscriptions from the threads
        this.#threads.forwardSubscriptions( this, {
            "on": this.#subscribe.bind( this, "threads", "on" ),
            "off": this.#subscribe.bind( this, "threads", "off" ),
        } );

        // re-publish events from threads
        this.#threads.on( "*", ( name, args ) => this.#publish( "threads", name, args ) );
    }

    // static
    static get Cli () {
        return Cli;
    }

    // properties
    get config () {
        return this.#config;
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
        if ( process.env.APP_DATABASE ) this.#dbh = await sql.new( process.env.APP_DATABASE );

        const apiEnabled = this.#dbh && this.config.apiEnabled,
            rpcEnabled = this.config.rpcEnabled,
            notificationsEnabled = apiEnabled,
            privateHttpServerEnabled = this.config.privateHttpServerEnabled || ( rpcEnabled && this.config.privateHttpServerEnabled !== false ),
            publicHttpServerEnabled = this.config.publicHttpServerEnabled || ( apiEnabled && this.config.publicHttpServerEnabled !== false );

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
        }

        // start public HTTP server
        if ( this.#publicHttpServer ) {
            process.stdout.write( `Starting public HTTP server ... ` );

            res = await this.#publicHttpServer.listen( "0.0.0.0", 80 );

            if ( res.ok ) console.log( `listening on 0.0.0.0:80` );
            else console.log( `unable bind to the 0.0.0.0:80` );

            if ( !res.ok ) return res;
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
        this.#subscribe( "local", "on", name, listener );
    }

    once ( name, listener ) {
        this.#subscribe( "local", "once", name, listener );
    }

    off ( name, listener ) {
        this.#subscribe( "local", "off", name, listener );
    }

    publish ( name, ...args ) {
        this.#publish( "local", name, args );
    }

    forwardClientEvent ( type, publisherId, name, msg ) {
        this.#events.emit( `${type}/out:${name}`, name, msg, {}, publisherId );
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

    async _initCluster ( clusterId, api ) {
        process.stdout.write( "Connecting to the cluster ... " );

        var res;

        if ( !clusterId || !api ) {
            res = result( [200, `Cluster is not configured`] );
        }
        else {
            this.#cluster = new Cluster( clusterId, api );

            await this.#cluster.waitConnect();

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
        const res = await api._init( options );

        if ( !res.ok ) return res;

        this.#api = api;

        return res;
    }

    async _createRpc ( Rpc, options ) {
        if ( this.#rpc ) throw Error( `RPC instance alrready created` );

        const rpc = new Rpc( this, options );

        // init api
        const res = await rpc._init( options );

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
    #subscribe ( source, method, name, listener ) {

        // api listen for api/out:*/name
        if ( name.startsWith( "api/out:" ) ) {
            this.#events[method]( name, listener );
            if ( this.#cluster ) this.cluster[method]( name, listener );
        }

        // rpc listen for rpc/out:name
        else if ( name.startsWith( "rpc/out:" ) ) {
            this.#events[method]( name, listener );
            if ( this.#cluster ) this.cluster[method]( name, listener );
        }
        else {
            if ( source === "local" ) this.#events[method]( name, listener );

            if ( name.startsWith( "/" ) && this.#cluster ) this.#cluster[method]( name, listener );
        }
    }

    #publish ( source, name, args ) {

        // from api client: api/in:name -> api/name
        if ( name.startsWith( "api/in:" ) ) {
            this.#events.emit( "api/" + name.substring( 4 ), ...args );
        }

        // from rpc client: rpc/in:name -> rpc/name
        else if ( name.startsWith( "rpc/in:" ) ) {
            this.#events.emit( "rpc/" + name.substring( 4 ), ...args );
        }

        // to api client
        else if ( name.startsWith( "api/out:" ) ) {
            this.#events.emit( name, ...args );
        }

        // to rpc client
        else if ( name.startsWith( "rpc/out:" ) ) {
            this.#events.emit( name, ...args );
        }

        // shortcut, to api clients
        else if ( name === "api" || name === "/api" ) {
            const global = name.startsWith( "/" ) && this.#cluster,
                targets = Array.isArray( args[0] ) ? args.shift() : [args.shift()],
                cache = {};

            name = args.shift();

            for ( const target of targets ) {
                this.#events.emit( `api/out:${target}/${name}`, name, args, cache );
                if ( global ) this.#cluster.publish( `api/out:${target}/${name}`, name, args );
            }
        }

        // shortcut, to rpc clients
        else if ( name === "rpc" || name === "/rpc" ) {
            const global = name.startsWith( "/" ) && this.#cluster,
                cache = {};

            name = args.shift();

            this.#events.emit( `rpc/out:${name}`, name, args, cache );
            if ( global ) this.#cluster.publish( `rpc/out:${name}`, name, args );
        }

        // other
        else {
            this.#events.emit( name, ...args );
            if ( source !== "threads" ) this.#threads.publish( name, ...args );
            if ( name.startsWith( "/" ) && this.#cluster ) this.cluster.publish( name, ...args );
        }
    }
}
