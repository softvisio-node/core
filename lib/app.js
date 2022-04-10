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
import * as appConfig from "#lib/app/config";
import sql from "#lib/sql";

export default class App {
    #location;
    #config;
    #env;
    #localEvents = new Events();
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
        this.#config = appConfig.mergeAppConfig( config );

        // set mode
        if ( process.cli?.options.mode ) env.mode = process.cli.options.mode;

        // init environment
        this.#env = env.loadEnv();

        // init services
        this.#services = new ApiServices();
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
        var res;

        // signal handlers
        process.on( "SIGINT", () => this._terminate() );

        process.on( "SIGTERM", () => this._terminate() );

        // validate configs
        process.stdout.write( `Validating application configs ... ` );
        res = appConfig.validateAppConfig( this.#location, this.#config, this.#env );
        console.log( res + "" );
        if ( !res.ok ) {
            console.log( res.data + "" );
            return res;
        }

        // init services
        res = await this._initServices();
        if ( !res.ok ) return res;

        // init cluster
        res = await this._initCluster( process.env.APP_CLUSTER_ID, this.services.get( "core" ) );
        if ( !res.ok ) return res;

        // create threads
        if ( this.#config.threadsEnabled || this.#config.apiEnabled ) this._createThreads();

        // create dbh
        if ( process.env.APP_DATABASE ) this.#dbh = await sql.new( process.env.APP_DATABASE );

        const apiEnabled = this.config.apiEnabled,
            rpcEnabled = this.config.rpcEnabled,
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
        if ( this.#config.notificationsEnabled ) {
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

        // init threads
        if ( this.#config.threadsEnabled ) {
            const threadsConfig = this._initThreads();
            if ( threadsConfig ) {
                process.stdout.write( "Starting threads ... " );
                res = await this.threads.run( threadsConfig );
                console.log( res + "" );
                if ( !res.ok ) return res;
            }
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
            process.stdout.write( `Starting private HTTP server ... ` );

            res = await this.#privateHttpServer.listen( { "hostname": "0.0.0.0", "port": this.#config.privateHttpServerPort } );

            this.#config.privateHttpServerPort = res.data.port;

            if ( res.ok ) console.log( `listening on ${res.data.hostname}:${res.data.port}` );
            else console.log( `unable bind to the ${res.data.hostname}:${res.data.port}` );

            if ( !res.ok ) return res;
        }

        // start public HTTP server
        if ( this.#publicHttpServer ) {
            process.stdout.write( `Starting public HTTP server ... ` );

            res = await this.#publicHttpServer.listen( { "hostname": "0.0.0.0", "port": this.#config.publicHttpServerPort } );

            this.#config.publicHttpServerPort = res.data.port;

            if ( res.ok ) console.log( `listening on ${res.data.hostname}:${res.data.port}` );
            else console.log( `unable bind to the ${res.data.hostname}:${res.data.port}` );

            if ( !res.ok ) return res;
        }

        // run notifications
        if ( this.#config.notificationsEnabled ) {
            res = await this.notifications.run();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    // events
    on ( name, listener ) {
        this.#subscribe( "on", name, listener );
    }

    once ( name, listener ) {
        this.#subscribe( "once", name, listener );
    }

    off ( name, listener ) {
        this.#subscribe( "off", name, listener );
    }

    publish ( name, ...args ) {
        this.#publish( "local", name, args );
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

    _createThreads () {

        // init threads
        this.#threads = new Threads();

        // forward global subscriptions from the threads to the cluster
        if ( this.#cluster ) {
            this.#threads.forwardSubscriptions( this.#cluster, {
                "on": ( name, listener ) => {
                    if ( name.startsWith( "/" ) ) this.#cluster.on( name, listener );
                },
                "off": ( name, listener ) => {
                    if ( name.startsWith( "/" ) ) this.#cluster.off( name, listener );
                },
            } );
        }

        // re-publish events from threads
        this.#threads.on( "*", ( name, args ) => this.#publish( "threads", name, args ) );
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

        // forward subscriptions from the api to the cluster
        if ( this.#cluster ) {
            api.forwardSubscriptions( this.#cluster, {
                "on": ( name, listener ) => this.#cluster.on( "api/" + name, listener ),
                "off": ( name, listener ) => this.#cluster.off( "api/" + name, listener ),
            } );
        }

        // re-publish events from api
        api.on( "*", ( name, args ) => this.#localEvents.emit( "api/" + name, ...args ) );

        return res;
    }

    async _createRpc ( Rpc, options ) {
        if ( this.#rpc ) throw Error( `RPC instance alrready created` );

        const rpc = new Rpc( this, options );

        // init api
        const res = await rpc._init( options );

        if ( !res.ok ) return res;

        this.#rpc = rpc;

        // forward subscriptions from the rpc to the cluster
        if ( this.#cluster ) {
            rpc.forwardSubscriptions( this.#cluster, {
                "on": ( name, listener ) => this.#cluster.on( "rpc/" + name, listener ),
                "off": ( name, listener ) => this.#cluster.off( "rpc/" + name, listener ),
            } );
        }

        // re-publish events from rpc
        rpc.on( "*", ( name, args ) => this.#localEvents.emit( "rpc/" + name, ...args ) );

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
    #subscribe ( method, name, listener ) {
        this.#localEvents[method]( name, listener );

        if ( name.startsWith( "/" ) && this.#cluster ) this.#cluster[method]( name, listener );
    }

    #publish ( source, name, args ) {

        // to api
        if ( name.startsWith( "api/" ) || name.startsWith( "/api/" ) ) {
            if ( !this.#api ) return;

            let global;
            if ( name.startsWith( "/" ) ) {
                name = name.substring( 1 );
                global = this.#cluster;
            }

            if ( name.endsWith( "/" ) ) {
                const targets = Array.isArray( args[0] ) ? args.shift() : [args.shift()],
                    targetName = name.substring( 4 ),
                    cache = {};

                for ( const target of targets ) {
                    this.#api.forwardEvent( targetName + target, args, cache );
                    if ( global ) this.#cluster.publish( name + target, ...args );
                }
            }
            else {
                this.#api.publish( name.substring( 4 ), ...args );
                if ( global ) this.#cluster.publish( name, ...args );
            }
        }

        // to rpc
        else if ( name.startsWith( "rpc/" ) || name.startsWith( "/rpc/" ) ) {
            if ( !this.#rpc ) return;

            let global;
            if ( name.startsWith( "/" ) ) {
                name = name.substring( 1 );
                global = this.#cluster;
            }

            this.#rpc.forwardEvent( name.substring( 4 ), args, {} );
            if ( global ) this.#cluster.publish( name, ...args );
        }

        // other
        else {

            // to local emitter
            this.#localEvents.emit( name, ...args );

            // to threads, do not re-publish, if published from threads
            if ( source !== "threads" ) this.#threads.publish( name, ...args );

            // global events to cluster
            if ( name.startsWith( "/" ) && this.#cluster ) this.cluster.publish( name, ...args );
        }
    }
}
