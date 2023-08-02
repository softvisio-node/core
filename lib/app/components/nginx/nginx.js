import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import { sleep } from "#lib/utils";
import Docker from "./nginx/docker.js";
import Signal from "#lib/threads/signal";
import NginxServer from "./nginx/server.js";
import Mutex from "#lib/threads/mutex";

const NGINX_STARTUP_DELAY = 3000;

export default class Nginx {
    #app;
    #config;
    #location;
    #proc;
    #docker;
    #configPath;
    #cacheDir;
    #vhostsDir;
    #isStarted = false;
    #isReloading;
    #pendingReload;
    #shutdownSignal = new Signal();
    #servers = {};
    #serverNames = {};
    #serverStreamPorts = {};
    #mutexSet = new Mutex.Set();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#location = this.#app.env.dataDir + "/nginx";
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get isReloading () {
        return this.#isReloading;
    }

    get configPath () {
        this.#configPath ??= this.#location + "/nginx.conf";

        return this.#configPath;
    }

    get cacheDir () {
        this.#cacheDir ??= this.#location + "/cache";

        return this.#cacheDir;
    }

    get vhostsDir () {
        this.#vhostsDir ??= this.#location + "/vhosts";

        return this.#vhostsDir;
    }

    // public
    // XXX mutex
    // XXX install default server
    async start () {
        if ( this.#isStarted ) return result( 200 );

        console.log( `Nginx starting` );

        // remove all vhosts
        if ( fs.existsSync( this.vhostsDir ) ) fs.rmSync( this.vhostsDir, { "recursive": true, "force": true } );

        // init directories structure
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
        if ( !fs.existsSync( this.cacheDir ) ) fs.mkdirSync( this.cacheDir, { "recursive": true } );
        if ( !fs.existsSync( this.vhostsDir ) ) fs.mkdirSync( this.vhostsDir, { "recursive": true } );

        // generate nginx config
        const conf = ejs.render( fs.readFileSync( new URL( "resources/templates/nginx.conf", import.meta.url ), "utf8" ), {
            "baseDir": this.#location,
            "vhostsDir": this.vhostsDir,
            "httpPort": this.config.httpPort,
            "cacheEnabled": this.config.cache.enabled,
            "cacheDir": this.cacheDir,
            "cacheMaxSize": this.config.cache.maxSize,
            "cacheMinFree": this.config.cache.minFree,
            "cacheInactive": this.config.cache.inactive,
        } );

        // deploy nginx config
        fs.writeFileSync( this.configPath, conf );

        // start nginx
        this.#proc = childProcess.spawn( "nginx", ["-c", this.configPath], {
            "detached": true,
            "stdio": "inherit",
        } );

        this.#proc.on( "exit", this.#onProcExit.bind( this ) );

        // setup signal handlers
        // process.on( "SIGHUP", this.reload.bind( this, false ) );
        // process.on( "SIGUSR1", this.reopenLogFiles.bind( this ) );
        // process.on( "SIGUSR2", this.upgradeExecutable.bind( this ) );
        // process.on( "SIGWINCH", this.gracefulShutDownWorkers.bind( this ) );

        // XXX improve
        // wait for nginx started
        await sleep( NGINX_STARTUP_DELAY );

        console.log( `Nginx started` );

        // start docker swarm listener
        if ( this.config.dockerEnabled ) {
            this.#docker = new Docker( this );

            await this.#docker.start();
        }

        this.#isStarted = true;

        return result( 200 );
    }

    // XXX mutex
    async shutDown () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx shutting down` );

        await this.#docker?.stop();
        this.#docker = null;

        this.#proc?.kill( "SIGTERM" );

        return this.#shutdownSignal.wait();
    }

    // XXX mutex
    // XXX delay
    // XXX wait threads
    async reload () {
        if ( !this.#isStarted ) return;

        const mutex = this.#mutexSet.get( "reload" );

        if ( !mutex.tryLock() ) {
            this.#pendingReload = true;

            return mutex.wait();
        }

        this.#isReloading = true;

        while ( 1 ) {
            this.#pendingReload = false;

            if ( this.test() ) {
                console.log( `Nginx reloading` );

                this.#proc?.kill( "SIGHUP" );
            }

            // wait for nginx started
            await sleep( NGINX_STARTUP_DELAY );

            if ( !this.#pendingReload ) break;
        }

        this.#isReloading = false;

        await this.#onNginxReady();

        mutex.up();
    }

    async gracefulShutDown () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx graceful shutting down` );

        this.#proc?.kill( "SIGQUIT" );

        return this.#shutdownSignal.wait();
    }

    reopenLogFiles () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx reopening log files` );

        this.#proc?.kill( "SIGUSR1" );
    }

    upgradeExecutable () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx upgrading executable` );

        this.#proc?.kill( "SIGUSR2" );
    }

    gracefulShutDownWorkers () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx graceful shutting down workers` );

        this.#proc?.kill( "SIGWINCH" );
    }

    test () {
        console.log( `Nginx testing configuration` );

        try {
            childProcess.execFileSync( "nginx", ["-t", "-c", this.configPath], { "stdio": "inherit" } );

            return true;
        }
        catch ( e ) {
            return;
        }
    }

    getServer ( id ) {
        return this.#servers[id];
    }

    adServer ( id, options ) {
        if ( this.#servers[id] ) return result( [400, `Server id already exists`] );

        const server = new NginxServer( id, options );

        for ( const name of server.serverNames ) {
            if ( this.#serverNames[name] ) return result( [400, `Server name already exists`] );
        }

        for ( const streamPort of server.streamPorts ) {
            if ( streamPort === this.config.httpPort || this.#serverStreamPorts[streamPort] ) return result( [400, `Server stream port already exists`] );
        }

        this.#servers[server.id] = server;

        for ( const name of server.serverNames ) {
            this.#serverNames[name] = server;
        }

        for ( const streamPort of server.streamPorts ) {
            this.#serverStreamPorts[streamPort] = server;
        }

        this.reload();

        return result( 200 );
    }

    deleteServer ( id ) {
        const server = this.#servers[id];

        if ( !server ) return;

        delete this.#servers[server.id];

        for ( const name of server.serverNames ) {
            delete this.#serverNames[name];
        }

        for ( const streamPort of server.streamPorts ) {
            delete this.#serverStreamPorts[streamPort];
        }

        server.delete();

        this.reload();
    }

    // private
    #onProcExit ( code, signal ) {
        this.#proc = null;
        this.#isStarted = false;

        console.log( `Nginx process exited, code: ${code}` );

        this.#shutdownSignal.broadcast();

        process.shutDown( { code } );
    }

    async #onNginxReady () {
        const promises = [];

        for ( const server of Object.values( this.#servers ) ) {
            promises.push( server.syncUpstreams() );
        }

        return Promise.all[promises];
    }
}
