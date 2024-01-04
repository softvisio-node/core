import fs from "node:fs";
import childProcess from "node:child_process";
import ejs from "#lib/ejs";
import Docker from "./nginx/docker.js";
import NginxProxy from "./nginx/proxy.js";
import Mutex from "#lib/threads/mutex";
import Counter from "#lib/threads/counter";
import Interval from "#lib/interval";
import DigitalSize from "#lib/digital-size";
import Acme from "./nginx/acme.js";
import { resolve } from "#lib/utils";
import subnets from "#lib/ip/subnets";

const nginxConfigTemplate = ejs.fromFile( new URL( "resources/nginx.conf", import.meta.url ) ),
    reouterConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-router.nginx.conf", import.meta.url ) );

export default class Nginx {
    #app;
    #config;
    #location;
    #proc;
    #docker;
    #configPath;
    #setRealIpfromPath;
    #cacheDir;
    #configsDir;
    #acmeChallengesLocation;
    #isStarted = false;
    #isShuttingDown = false;
    #mutexSet = new Mutex.Set();
    #activityCounter = new Counter();
    #proxies = new Map();
    #acme;
    #acmeChallengesUrl;
    #unixSocketsDir;
    #httpsSocketPath;
    #pendingReload = false;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#location = this.#app.env.dataDir + "/nginx";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

        this.#acme = new Acme( this );

        this.#configsDir = this.#location + "/configs";

        this.#configPath ??= this.#configsDir + "/nginx.conf";

        this.#setRealIpfromPath = this.#configsDir + "/set-real-ip-from.nginx.conf";

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
        const component = this.app.components.get( "privateHttpServer" );

        if ( !component ) return null;

        return "_private-http-server-" + component.config.port;
    }

    get acmeChallengesUrl () {
        return this.#acmeChallengesUrl;
    }

    get unixSocketsDir () {
        if ( !this.#unixSocketsDir ) {
            this.#unixSocketsDir = "/var/run/" + this.app.env.instanceId;

            fs.mkdirSync( this.#unixSocketsDir, { "recursive": true } );
        }

        return this.#unixSocketsDir;
    }

    get httpsSocketPath () {
        this.#httpsSocketPath ??= this.unixSocketsDir + "/_https.443.socket";

        return this.#httpsSocketPath;
    }

    // public
    async start () {
        if ( this.#isStarted ) return result( 200 );

        // add private http server
        if ( this.app.privateHttpServer ) {
            const component = this.app.components.get( "privateHttpServer" );

            this.addProxy( "_private-http-server", component.config.port, {
                "servers": {
                    [component.config.port]: {
                        ...component.config.nginx,
                        "type": "http",
                    },
                },
                "upstreams": this.app.privateHttpServer.nginxAddress,
            } );
        }

        await this.#updateConfig();

        const res = await this.test();
        if ( !res.ok ) return res;

        this.#activityCounter.value++;

        // start nginx
        this.#proc = childProcess.spawn( "nginx", ["-c", this.#configPath], {
            "detached": true,
            "stdio": "inherit",
        } );

        this.#proc.on( "exit", this.#onProcExit.bind( this ) );

        this.#isStarted = true;

        // add public http server
        if ( this.app.publicHttpServer ) {
            const component = this.app.components.get( "publicHttpServer" );

            this.addProxy( `_public-http-server`, component.config.port, {
                "servers": {
                    [component.config.port]: {
                        ...component.config.nginx,
                        "type": "http",
                    },
                    "443": {
                        ...component.config.nginx,
                        "type": "http",
                    },
                },
                "upstreams": this.app.publicHttpServer.nginxAddress,
            } );
        }

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

    async reload () {
        return this.#updateConfig();
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

    getProxy ( name, upstreamPort ) {
        const id = `${name}-${upstreamPort}`;

        return this.#proxies.get( id );
    }

    addProxy ( name, upstreamPort, options ) {
        const id = `${name}-${upstreamPort}`;

        var proxy = this.#proxies.get( id );

        if ( proxy ) return proxy;

        proxy = new NginxProxy( this, name, upstreamPort, options );

        this.#proxies.set( id, proxy );

        this.reload();

        return proxy;
    }

    deleteProxy ( name, upstreamPort ) {
        const id = `${name}-${upstreamPort}`;

        const proxy = this.#proxies.get( id );

        if ( !proxy ) return;

        this.#proxies.delete( id );

        proxy.delete();

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

    // XXX
    async #updateConfig () {
        const mutex = this.#mutexSet.get( "reload" );

        if ( !mutex.tryLock() ) {
            this.#pendingReload = true;

            return mutex.wait();
        }

        while ( true ) {
            this.#pendingReload = false;

            this.#etiteNginxConfig();

            this.#writeSetRealIpFromConfig();

            const counter = new Counter(),
                ports = {},
                routers = new Map();

            for ( const proxy of this.#proxies.values() ) {
                for ( const server of proxy.servers.values() ) {
                    if ( server.port === 443 ) {

                        // XXX
                    }
                }

                counter.value++;

                proxy.updateConfig( ports ).then( () => counter.value-- );
            }

            await counter.wait();

            // XXX
            if ( routers.size ) {
                for ( const options of routers.values() ) {
                    this.#writeRouterConfig( options );

                    // / XXX
                    this.#writeRouterConfig( {
                        "port": 443,
                        "serverName": {},
                        "defaultSocket": this.httpsSocketPath,
                    } );
                }
            }

            if ( !this.#pendingReload ) break;
        }

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
    }

    #etiteNginxConfig () {

        // remove all configs
        fs.rmSync( this.configsDir, {
            "recursive": true,
            "force": true,
        } );

        // create http cache directory
        if ( !fs.existsSync( this.#cacheDir ) ) fs.mkdirSync( this.#cacheDir, { "recursive": true } );

        // generate nginx config
        const conf = nginxConfigTemplate.render( {
            "baseDir": this.#location,
            "configsDir": this.configsDir,
            "setRealIpfromPath": this.#setRealIpfromPath,
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
            "httpsSocketPath": this.httpsSocketPath,
        } );

        // deploy nginx config
        fs.mkdirSync( this.configsDir, { "recursive": true } );
        fs.writeFileSync( this.#configPath, conf );
    }

    #writeSetRealIpFromConfig () {
        const setRealIpFrom = ["# unix\nset_real_ip_from    unix:;\n"];

        for ( const name of ["local", "private", "cloudflare", "google-cloud-load-balancers"] ) {
            setRealIpFrom.push( `# ${name}\n` +
                    subnets
                        .get( name )
                        .toJSON()
                        .map( cidr => `set_real_ip_from    ${cidr};\n` )
                        .join( "" ) );
        }

        fs.writeFileSync( this.#setRealIpfromPath, setRealIpFrom.join( "\n" ) );
    }

    #writeRouterConfig ( { port, serverName, defaultSocket } = {} ) {
        const config = reouterConfigTemplate.render( {
            port,
            "listenIpFamily": this.config.listenIpFamily,
            "serverName": serverName || {},
            defaultSocket,
        } );

        fs.mkdirSync( this.configsDir + `/stream-servers`, { "recursive": true } );

        fs.writeFileSync( this.configsDir + `/stream-servers/_router-${port}.nginx.conf`, config );
    }
}
