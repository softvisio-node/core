import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import Events from "#lib/events";
import { sleep } from "#lib/utils";
import Signal from "#lib/threads/signal";
import NginxService from "./nginx/service.js";

const NGINX_STARTUP_DELAY = 3000;
const NGINX_RELOAD_CONFIG_DELAY = 3000;

export default class Nginx extends Events {
    #app;
    #config;
    #location;
    #proc;
    #configPath;
    #cacheDir;
    #vhostsDir;
    #isStarted = false;
    #isReloading;
    #pendingReload;
    #shutdownSignal = new Signal();
    #services = {};

    constructor ( app, config ) {
        super();

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
    // XXX
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
            "listenIpFamily": this.config.listenIpFamily,
            "port": this.config.httpPort,
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

        // wait for nginx started
        await sleep( NGINX_STARTUP_DELAY );

        console.log( `Nginx started` );

        // remove stale cache
        // fs.readdirSync( this.cacheDir, { "withFileTypes": true } )
        //     .filter( entry => entry.isDirectory() )
        //     .forEach( directory => {
        //         if ( !this.#services[directory.name] ) fs.rmSync( this.cacheDir + "/" + directory.name, { "recursive": true, "force": true } );
        //     } );

        this.#isStarted = true;

        this.reload();

        return result( 200 );
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

    async shutDown () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx shutting down` );

        this.#proc?.kill( "SIGTERM" );

        return this.#shutdownSignal.wait();
    }

    async gracefulShutDown () {
        if ( !this.#isStarted ) return;

        console.log( `Nginx graceful shutting down` );

        this.#proc?.kill( "SIGQUIT" );

        return this.#shutdownSignal.wait();
    }

    async reload ( delay ) {
        if ( !this.#isStarted ) return;

        if ( this.#isReloading ) {
            this.#pendingReload = true;

            return;
        }

        this.#isReloading = true;

        if ( delay ) await sleep( NGINX_RELOAD_CONFIG_DELAY );

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

        this.emit( "reload" );
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

    getService ( id ) {
        return this.#services[id];
    }

    // XXX
    async addUpstream ( remoteAddress, options ) {
        const id = NginxService.getId( options.serverName );

        var service = this.#services[id] ?? new NginxService( this, options );

        this.#services[service.id] = service;

        return result( 200 );
    }

    // XXX
    async deleteUpstream ( remoteAddress ) {
        return result( 200 );
    }

    // private
    #onProcExit ( code, signal ) {
        this.#proc = null;
        this.#isStarted = false;

        console.log( `Nginx process exited, code: ${code}` );

        process.exitCode = code;

        this.#shutdownSignal.broadcast();

        process.shutDown( { code } );
    }
}
