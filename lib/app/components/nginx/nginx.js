import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import Docker from "./nginx/docker.js";
import NginxServer from "./nginx/server.js";
import Mutex from "#lib/threads/mutex";
import Counter from "#lib/threads/counter";

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
    #isShuttingDown = false;
    #servers = {};
    #serverNames = {};
    #serverStreamPorts = {};
    #mutexSet = new Mutex.Set();
    #activityCounter = new Counter();

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

    get isSuttingDown () {
        return this.#isShuttingDown;
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

    get updateConfigMutex () {
        return this.#mutexSet.get( "update-config" );
    }

    // public
    async start () {
        if ( this.#isStarted ) return result( 200 );

        // remove all vhosts
        if ( fs.existsSync( this.configsDir ) ) fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

        // init directories structure
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
        if ( !fs.existsSync( this.cacheDir ) ) fs.mkdirSync( this.cacheDir, { "recursive": true } );
        if ( !fs.existsSync( this.configsDir ) ) fs.mkdirSync( this.configsDir, { "recursive": true } );

        // generate nginx config
        const conf = ejs.render( fs.readFileSync( new URL( "resources/nginx.conf", import.meta.url ), "utf8" ), {
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

        this.#activityCounter.value++;

        // start nginx
        this.#proc = childProcess.spawn( "nginx", ["-c", this.configPath], {
            "detached": true,
            "stdio": "inherit",
        } );

        this.#proc.on( "exit", this.#onProcExit.bind( this ) );

        this.#isStarted = true;

        // start docker swarm listener
        if ( this.config.dockerEnabled ) {
            this.#docker = new Docker( this );

            await this.#docker.start();
        }

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        await this.#docker?.stop();
        this.#docker = null;

        this.#proc?.kill( "SIGTERM" );

        return this.#activityCounter.wait();
    }

    reload () {
        this.#proc?.kill( "SIGHUP" );
    }

    async gracefulShutDown () {
        this.#proc?.kill( "SIGQUIT" );

        return this.#activityCounter.wait();
    }

    reopenLogFiles () {
        this.#proc?.kill( "SIGUSR1" );
    }

    upgradeExecutable () {
        this.#proc?.kill( "SIGUSR2" );
    }

    gracefulShutDownWorkers () {
        this.#proc?.kill( "SIGWINCH" );
    }

    async test () {
        if ( this.isShuttingDown ) return result( [400, `Nginx is shutting down`] );

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
                        resolve( result( [400, stderr] ) );
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

        const res = await server.updateNginxConfigs();
        if ( !res.ok ) return res;

        return result( 200, server );
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
        this.#isStarted = false;

        this.#proc = null;

        this.#docker?.stop();
        this.#docker = null;

        console.log( `Nginx process exited, code: ${code}` );

        this.#activityCounter.value--;

        process.shutDown( { code } );
    }
}
