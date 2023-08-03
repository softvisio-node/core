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
    #configsDir;
    #isStarted = false;
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

    get configPath () {
        this.#configPath ??= this.#location + "/nginx.conf";

        return this.#configPath;
    }

    get cacheDir () {
        this.#cacheDir ??= this.#location + "/cache";

        return this.#cacheDir;
    }

    get configsDir () {
        this.#configsDir ??= this.#location + "/servers";

        return this.#configsDir;
    }

    // public
    // XXX mutex
    // XXX install default server
    async start () {
        if ( this.#isStarted ) return result( 200 );

        console.log( `Nginx starting` );

        // remove all vhosts
        if ( fs.existsSync( this.configsDir ) ) fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

        // init directories structure
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
        if ( !fs.existsSync( this.cacheDir ) ) fs.mkdirSync( this.cacheDir, { "recursive": true } );
        if ( !fs.existsSync( this.configsDir ) ) fs.mkdirSync( this.configsDir, { "recursive": true } );

        // generate nginx config
        const conf = ejs.render( fs.readFileSync( new URL( "resources/templates/nginx.conf", import.meta.url ), "utf8" ), {
            "baseDir": this.#location,
            "configsDir": this.configsDir,
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

        // XXX improve
        // wait for nginx started
        await sleep( NGINX_STARTUP_DELAY );

        this.#isStarted = true;

        console.log( `Nginx started` );

        // start docker swarm listener
        if ( this.config.dockerEnabled ) {
            this.#docker = new Docker( this );

            await this.#docker.start();
        }

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

    reload () {
        this.#proc?.kill( "SIGHUP" );
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

    // XXX
    async test () {
        const mutex = this.#mutexSet.get( "test" );

        await mutex.lock();

        const res = await new Promise( resolve => {
            childProcess.execFile(
                "nginx",
                ["-t", "-c", this.configPath],
                {
                    "encoding": "utf8",
                    "maxBuffer": Infinity,
                },
                ( error, stdout, stderr ) => {
                    if ( error ) {
                        resolve( result( [400, error.message] ) );
                    }
                    else {
                        resolve( result( 200 ) );
                    }
                }
            );
        } );

        mutex.unlock();

        return res;
    }

    getServer ( id ) {
        return this.#servers[id];
    }

    async addServer ( id, options ) {
        if ( this.#servers[id] ) return result( [400, `Server id already exists`] );

        const server = new NginxServer( this, id, options );

        if ( !server.serverNames.size && !server.streamPorts.size ) return result( [400, `Nginx server ${server.id} can't be added`] );

        for ( const name of server.serverNames ) {
            if ( this.#serverNames[name] ) return result( [400, `Nginx server name already used: "${name}"`] );
        }

        for ( const streamPort of server.streamPorts ) {
            if ( streamPort === this.config.httpPort || this.#serverStreamPorts[streamPort] ) return result( [400, `Nginx server stream port already used: ${streamPort}`] );
        }

        this.#servers[server.id] = server;

        for ( const name of server.serverNames ) {
            this.#serverNames[name] = server;
        }

        for ( const streamPort of server.streamPorts ) {
            this.#serverStreamPorts[streamPort] = server;
        }

        const res = await server.install();

        return res;
    }

    async deleteServer ( id ) {
        const server = this.#servers[id];

        if ( !server ) return;

        delete this.#servers[server.id];

        for ( const name of server.serverNames ) {
            delete this.#serverNames[name];
        }

        for ( const streamPort of server.streamPorts ) {
            delete this.#serverStreamPorts[streamPort];
        }

        await server.delete();

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
}
