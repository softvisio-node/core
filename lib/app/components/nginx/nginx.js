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
import NginxConfig from "./nginx/config.js";

const nginxConfigTemplate = ejs.fromFile( new URL( "resources/nginx.conf", import.meta.url ) ),
    reouterConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-router.nginx.conf", import.meta.url ) );

const SET_REAL_IP_FROM_SUBNETS = new Set( ["local", "private", "cloudflare", "google-cloud-load-balancers"] );

export default class Nginx {
    #app;
    #config;

    #dataDir;
    #cacheDir;
    #configsDir;
    #configPath;
    #setRealIpfromPath;

    #docker;

    #mutexSet = new Mutex.Set();
    #proxies = new Map();
    #activityCounter = new Counter();

    #proc;
    #isStarted = false;
    #isShuttingDown = false;
    #pendingReload = false;

    #acme;

    #acmeChallengesStorageLocation;
    #acmeChallengesUrl;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dataDir = this.#app.env.dataDir + "/nginx";

        this.#cacheDir ??= this.#dataDir + "/cache";

        this.#configsDir = this.#dataDir + "/configs";

        this.#configPath ??= this.#configsDir + "/nginx.conf";

        this.#setRealIpfromPath = this.#configsDir + "/set-real-ip-from.nginx.conf";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

        this.#acme = new Acme( this );

        this.#acmeChallengesStorageLocation ??= this.#config.storageLocation + "/acme-challenges";

        this.#acmeChallengesUrl = this.app.storage?.getFileUrl( this.#acmeChallengesStorageLocation );

        subnets.on( "add", this.#onSubnetsUpdate.bind( this ) );
        subnets.on( "delete", this.#onSubnetsUpdate.bind( this ) );
        subnets.on( "update", this.#onSubnetsUpdate.bind( this ) );
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

    get dataDir () {
        return this.#dataDir;
    }

    get cacheDir () {
        return this.#cacheDir;
    }

    get configsDir () {
        return this.#configsDir;
    }

    get setRealIpfromPath () {
        return this.#setRealIpfromPath;
    }

    get acme () {
        return this.#acme;
    }

    get acmeChallengesStorageLocation () {
        return this.#acmeChallengesStorageLocation;
    }

    get privateHrrpServerUpstream () {
        const component = this.app.components.get( "privateHttpServer" );

        if ( !component ) return null;

        return "private-http-server-" + component.config.port;
    }

    get acmeChallengesUrl () {
        return this.#acmeChallengesUrl;
    }

    // public
    async start () {
        if ( this.#isStarted ) return result( 200 );

        // add private http server
        if ( this.app.privateHttpServer ) {
            const component = this.app.components.get( "privateHttpServer" );

            this.addProxy( "private-http-server", component.config.port, {
                "servers": [
                    {
                        "port": component.config.port,
                        ...component.config.nginx,
                        "type": "http",
                    },
                ],
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

            this.addProxy( "public-http-server", component.config.port, {
                "servers": [
                    {
                        "port": component.config.port,
                        ...component.config.nginx,
                        "type": "http",
                    },
                    {
                        "port": 443,
                        ...component.config.nginx,
                        "type": "http",
                    },
                ],
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

    getHttpsSocketPath ( port ) {
        return this.app.env.unixSocketsDir + "/nginx-https." + port + ".socket";
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

    async #updateConfig () {
        const mutex = this.#mutexSet.get( "reload" );

        if ( !mutex.tryLock() ) {
            this.#pendingReload = true;

            return mutex.wait();
        }

        var config;

        while ( true ) {
            this.#pendingReload = false;

            // remove all configs
            fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

            // create http cache directory
            if ( !fs.existsSync( this.#cacheDir ) ) fs.mkdirSync( this.#cacheDir, { "recursive": true } );

            config = new NginxConfig( this );

            for ( const proxy of this.#proxies.values() ) {
                for ( const server of proxy.servers ) {
                    config.addServer( server );
                }
            }

            const counter = new Counter();

            // generate servers configs
            for ( const server of config.servers ) {
                counter.value++;

                server
                    .writeConfig( {
                        "useRouter": config.isRouterPort( server.port ),
                    } )
                    .then( () => counter.value-- );
            }

            await counter.wait();

            if ( !this.#pendingReload ) break;
        }

        // generate proxies configs
        for ( const { proxy, options } of config.proxies ) {
            proxy.writeConfig( options );
        }

        // generate routers
        for ( const options of config.getRouters() ) {
            this.#writeRouterConfig( options );
        }

        // write nginx config
        this.#writeNginxConfig( {
            "useRouter": config.isRouterPort( 443 ),
        } );

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
    }

    #writeNginxConfig ( { useRouter } = {} ) {

        // generate nginx config
        const conf = nginxConfigTemplate.render( {
            "nginx": this,
            useRouter,
            "listenIpFamily": this.config.listenIpFamily,

            "defaultCertificate": resolve( "./resources/default.crt.pem", import.meta.url ),
            "defaultCertificateKey": resolve( "./resources/default.key.pem", import.meta.url ),

            "maxBodySize": DigitalSize.new( this.config.maxBodySize ).toNginx(),

            "cacheMaxSize": DigitalSize.new( this.config.cacheMaxSize ).toNginx(),
            "cacheMinFree": DigitalSize.new( this.config.cacheMinFree ).toNginx(),
            "cacheInactive": Interval.new( this.config.cacheInactive ).toNginx(),
            "cacheBypass": this.config.cacheBypass,
        } );

        // deploy nginx config
        fs.mkdirSync( this.configsDir, { "recursive": true } );
        fs.writeFileSync( this.#configPath, conf );

        this.#writeSetRealIpFromConfig();
    }

    #writeSetRealIpFromConfig () {
        const setRealIpFrom = ["# unix socket\nset_real_ip_from    unix:;\n"];

        for ( const name of SET_REAL_IP_FROM_SUBNETS ) {
            const range = subnets.get( name );

            if ( !range ) continue;

            setRealIpFrom.push( `# ${name}\n` +
                    range
                        .toJSON()
                        .map( cidr => `set_real_ip_from    ${cidr};\n` )
                        .join( "" ) );
        }

        fs.writeFileSync( this.#setRealIpfromPath, setRealIpFrom.join( "\n" ) );
    }

    #writeRouterConfig ( { port, serverName, defaultSocket, proxyProtocol } = {} ) {
        const config = reouterConfigTemplate.render( {
            port,
            "listenIpFamily": this.config.listenIpFamily,
            "serverName": serverName || {},
            defaultSocket,
            proxyProtocol,
        } );

        fs.mkdirSync( this.configsDir + `/stream-servers`, { "recursive": true } );

        fs.writeFileSync( this.configsDir + `/stream-servers/_router-${port}.nginx.conf`, config );
    }

    #onSubnetsUpdate ( name ) {
        if ( SET_REAL_IP_FROM_SUBNETS.has( name ) ) this.reload();
    }
}
