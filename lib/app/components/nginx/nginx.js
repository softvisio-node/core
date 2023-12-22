import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import Docker from "./nginx/docker.js";
import NginxServer from "./nginx/server.js";
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
    #acme;
    #acmeChallengesUrl;
    #unixSocketsPath;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#location = this.#app.env.dataDir + "/nginx";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

        this.#acme = new Acme( this );

        this.#acmeChallengesUrl = this.app.storage.getFileUrl( this.acmeChallengesLocation );
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

    get acmeChallengesLocation () {
        this.#acmeChallengesLocation ??= this.#config.storageLocation + "/acme-challenges";

        return this.#acmeChallengesLocation;
    }

    get updateConfigMutex () {
        return this.#mutexSet.get( "update-config" );
    }

    get servers () {
        return Object.values( this.#servers );
    }

    get acme () {
        return this.#acme;
    }

    get privateHrrpServerUpstream () {
        const privateHttpServer = this.app.privateHttpServer;

        if ( !privateHttpServer ) return null;

        return `${privateHttpServer.address}:${privateHttpServer.port}`;
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
    // XXX
    async start () {
        if ( this.#isStarted ) return result( 200 );

        // remove all vhosts
        if ( fs.existsSync( this.configsDir ) ) fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

        // init directories structure
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
        if ( !fs.existsSync( this.cacheDir ) ) fs.mkdirSync( this.cacheDir, { "recursive": true } );
        if ( !fs.existsSync( this.configsDir ) ) fs.mkdirSync( this.configsDir, { "recursive": true } );

        // generate nginx config
        const conf = await ejs.renderFile( new URL( "resources/nginx.conf", import.meta.url ), {
            "baseDir": this.#location,
            "configsDir": this.configsDir,
            "cacheEnabled": this.config.cacheEnabled,
            "cacheDir": this.cacheDir,
            "cacheMaxSize": DigitalSize.new( this.config.cacheMaxSize ).toNginx(),
            "cacheMinFree": DigitalSize.new( this.config.cacheMinFree ).toNginx(),
            "cacheInactive": Interval.new( this.config.cacheInactive ).toNginx(),
            "cacheBypass": this.config.cacheBypass,

            "listenIpFamily": this.config.listenIpFamily,
            "privateHrrpServerUpstream": this.privateHrrpServerUpstream,
            "acmeChallengesUrl": this.acmeChallengesUrl,
            "defaultCertificate": resolve( "./resources/default.crt.pem", import.meta.url ),
            "defaultCertificateKey": resolve( "./resources/default.key.pem", import.meta.url ),
            "unixSocketsPath": this.unixSocketsPath,

            "maxBodySize": DigitalSize.new( this.config.maxBodySize ).toNginx(),
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

        // add private http server
        if ( this.app.privateHttpServer ) {
            const component = this.app.components.get( "privateHttpServer" );

            this.addServer( "_private-http-server", {
                ...component.config.nginx,
                "type": "http",
                "port": component.config.port,
                "defaultUpstreamPort": this.app.privateHttpServer.port,
                "upstreams": [this.app.privateHttpServer.address],
            } );

            // if ( !res.ok ) return res;
        }

        // add public http server
        if ( this.app.publicHttpServer ) {
            const component = this.app.components.get( "publicHttpServer" );

            this.addServer( "_public-http-server", {
                ...component.config.nginx,
                "type": "http",
                "port": component.config.port,
                "defaultUpstreamPort": this.app.publicHttpServer.port,
                "upstreams": [this.app.publicHttpServer.address],
            } );

            // if ( !res.ok ) return res;
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

    // XXX
    addServer ( id, { type, port, serverNames, defaultUpstreamPort, upstreams, maxBodySize, cacheEnabled, cacheBypass } = {} ) {
        const server = this.getServer( id );

        if ( server ) return server;

        this.#servers[id] = new NginxServer( this, id, {
            type,
            port,
            serverNames,
            defaultUpstreamPort,
            upstreams,
            maxBodySize,
            cacheEnabled,
            cacheBypass,
        } );

        return this.#servers[id];
    }

    async deleteServer ( id ) {
        const server = this.#servers[id];

        if ( !server ) return;

        delete this.#servers[server.id];

        return server.delete();
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
