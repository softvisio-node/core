import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import Docker from "./nginx/docker.js";
import NginxUpstream from "./nginx/upstream.js";
import Mutex from "#lib/threads/mutex";
import Counter from "#lib/threads/counter";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";
import Acme from "./nginx/acme.js";
import { resolve } from "#lib/utils";

export default class Nginx {
    #app;
    #config;
    #location;
    #proc;
    #docker;
    #configPath;
    #cacheDir;
    #configsDir;
    #acmeChallengesLocation;
    #isStarted = false;
    #isShuttingDown = false;
    #mutexSet = new Mutex.Set();
    #activityCounter = new Counter();
    #servers = {};
    #upstreams = new Map();
    #acme;
    #acmeChallengesUrl;
    #unixSocketsPath;
    #pendingReload = false;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#location = this.#app.env.dataDir + "/nginx";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

        this.#acme = new Acme( this );

        this.#configsDir = this.#location + "/configs";

        this.#configPath ??= this.#configsDir + "/nginx.conf";

        this.#cacheDir ??= this.#location + "/cache";

        this.#acmeChallengesUrl = this.app.storage?.getFileUrl( this.acmeChallengesLocation );
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

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get configsDir () {
        return this.#configsDir;
    }

    get acme () {
        return this.#acme;
    }

    get acmeChallengesLocation () {
        this.#acmeChallengesLocation ??= this.#config.storageLocation + "/acme-challenges";

        return this.#acmeChallengesLocation;
    }

    get privateHrrpServerUpstream () {
        const privateHttpServer = this.app.privateHttpServer;

        if ( !privateHttpServer ) return null;

        // ip address
        if ( privateHttpServer.port ) {
            return `${privateHttpServer.address}:${privateHttpServer.port}`;
        }

        // unix socket
        else {
            return `unix:${privateHttpServer.address}`;
        }
    }

    get acmeChallengesUrl () {
        return this.#acmeChallengesUrl;
    }

    get unixSocketsPath () {
        if ( !this.#unixSocketsPath ) {
            this.#unixSocketsPath = "/var/run/nginx." + this.app.env.instanceId;

            fs.mkdirSync( this.#unixSocketsPath, { "recursive": true } );
        }

        return this.#unixSocketsPath;
    }

    // public
    async start () {
        var res;

        if ( this.#isStarted ) return result( 200 );

        // remove all vhosts
        if ( fs.existsSync( this.configsDir ) ) fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

        // init directories structure
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
        if ( !fs.existsSync( this.#cacheDir ) ) fs.mkdirSync( this.#cacheDir, { "recursive": true } );
        if ( !fs.existsSync( this.configsDir ) ) fs.mkdirSync( this.configsDir, { "recursive": true } );

        // generate nginx config
        const conf = await ejs.renderFile( new URL( "resources/nginx.conf", import.meta.url ), {
            "baseDir": this.#location,
            "configsDir": this.configsDir,
            "cacheDir": this.#cacheDir,
            "cacheMaxSize": DigitalSize.new( this.config.cacheMaxSize ).toNginx(),
            "cacheMinFree": DigitalSize.new( this.config.cacheMinFree ).toNginx(),
            "cacheInactive": Interval.new( this.config.cacheInactive ).toNginx(),
            "cacheBypass": this.config.cacheBypass,

            "maxBodySize": DigitalSize.new( this.config.maxBodySize ).toNginx(),

            "listenIpFamily": this.config.listenIpFamily,
            "privateHrrpServerUpstream": this.privateHrrpServerUpstream,
            "acmeChallengesUrl": this.acmeChallengesUrl,
            "defaultCertificate": resolve( "./resources/default.crt.pem", import.meta.url ),
            "defaultCertificateKey": resolve( "./resources/default.key.pem", import.meta.url ),
            "unixSocketsPath": this.unixSocketsPath,
        } );

        // deploy nginx config
        fs.writeFileSync( this.#configPath, conf );

        this.#activityCounter.value++;

        // start nginx
        this.#proc = childProcess.spawn( "nginx", ["-c", this.#configPath], {
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

        // add private http server
        if ( this.app.privateHttpServer ) {
            const component = this.app.components.get( "privateHttpServer" );

            const server = this.addServer( `_private-http-server-${component.config.port}`, {
                ...component.config.nginx,
                "type": "http",
                "port": component.config.port,
                "upstreamPort": this.app.privateHttpServer.port,
            } );

            if ( this.app.privateHttpServer.port ) {
                res = await server.addUpstreams( this.app.privateHttpServer.address );
            }
            else {
                res = await server.addUpstreams( `unix:${this.app.privateHttpServer.address}` );
            }

            if ( !res.ok ) return res;
        }

        // add public http server
        if ( this.app.publicHttpServer ) {
            const component = this.app.components.get( "publicHttpServer" );

            const server = this.addServer( `_public-http-server-${component.config.port}`, {
                ...component.config.nginx,
                "type": "http",
                "port": component.config.port,
                "upstreamPort": this.app.publicHttpServer.port,
            } );

            if ( this.app.publicHttpServer.port ) {
                res = await server.addUpstreams( this.app.publicHttpServer.address );
            }
            else {
                res = await server.addUpstreams( `unix:${this.app.publicHttpServer.address}` );
            }

            if ( !res.ok ) return res;
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

    async reload () {
        if ( !this.#proc ) return;

        const mutex = this.#mutexSet.get( "reload" );

        if ( !mutex.tryLock() ) {
            this.#pendingReload = true;

            return mutex.wait();
        }

        while ( true ) {
            this.#pendingReload = false;

            // XXX
            fs.writeFileSync( `${this.configsDir}/ssl-server-upstreams/*.443.nginx.conf`, "" );

            for ( const upstream of this.#upstreams.values() ) {
                await upstream.updateConfig();
            }

            if ( !this.#pendingReload ) break;
        }

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
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
                ["-t", "-c", this.#configPath],
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

    addUpstream ( name, port, options ) {
        const id = `${name}-${port}`;

        var upstream = this.#upstreams.get( id );

        if ( upstream ) return upstream;

        upstream = new NginxUpstream( this, name, port, options );

        this.#upstreams.set( id, upstream );

        this.reload();
    }

    deleteUpstream ( name, port ) {
        const id = `${name}-${port}`;

        const upstream = this.#upstreams.get( id );

        if ( !upstream ) return;

        this.#upstreams.delete( id );

        upstream.delete();

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
