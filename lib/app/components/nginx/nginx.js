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
import subnets from "#lib/ip/subnets";
import NginxConfig from "./nginx/config.js";
import crypto from "node:crypto";
import { sleep } from "#lib/utils";
import certificates from "#lib/certificates";

const nginxConfigTemplate = ejs.fromFile( new URL( "resources/nginx.conf", import.meta.url ) ),
    reouterConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-router.nginx.conf", import.meta.url ) ),
    defaultHttpServerConfigTemplate = ejs.fromFile( new URL( "resources/server.http-default.nginx.conf", import.meta.url ) );

const SET_REAL_IP_FROM_SUBNETS = new Set( [ "local", "private", "cloudflare", "google-cloud-load-balancers" ] );

var USE_LOCAL_SOCKET = true,
    LISTEN_ADDRESS = "127.0.0.5",
    LISTEN_PORT = 33000,
    LISTEB_ADDRESSES = {};

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
    #defaultCertificate;

    #acmeChallengesStorageLocation;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dataDir = this.#app.env.dataDir + "/nginx";

        this.#cacheDir ??= this.#dataDir + "/cache";

        this.#configsDir = this.app.env.tmpDir + "/nginx";

        this.#configPath ??= this.#configsDir + "/nginx.conf";

        this.#setRealIpfromPath = this.#configsDir + "/set-real-ip-from.nginx.conf";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

        this.#acmeChallengesStorageLocation = this.#config.storageLocation + "/acme-challenges";

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

    get proxies () {
        return this.#proxies.values();
    }

    get listenIpV4 () {
        return !this.config.listenIpFamily || this.config.listenIpFamily === 4;
    }

    get listenIpV6 () {
        return !this.config.listenIpFamily || this.config.listenIpFamily === 6;
    }

    get defaultCertificate () {
        return this.#defaultCertificate;
    }

    // public
    async init () {
        var res;

        const { certificate, privateKey } = await certificates.createCertificate();

        this.#defaultCertificate = {
            "certificate": new this.app.env.TmpFile(),
            "privateKey": new this.app.env.TmpFile(),
        };

        fs.writeFileSync( this.#defaultCertificate.certificate + "", certificate );

        fs.writeFileSync( this.#defaultCertificate.privateKey + "", privateKey );

        // init acme
        if ( this.app.storage ) {
            this.#acme = new Acme( this );

            res = await this.#acme.init();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async start () {
        var res;

        if ( this.#isStarted ) return result( 200 );

        // add private http server
        if ( this.app.privateHttpServer ) {
            const component = this.app.components.get( "privateHttpServer" );

            this.addProxy( "private-http-server", component.config.port, {
                "servers": [
                    {
                        ...component.config.nginx,
                        "port": component.config.port,
                        "type": "http",
                    },
                ],
                "upstreams": this.app.privateHttpServer.nginxAddress,
            } );
        }

        await this.#updateConfig();

        res = await this.test();
        if ( !res.ok ) return res;

        this.#activityCounter.value++;

        // start nginx
        this.#proc = childProcess.spawn( "nginx", [ "-c", this.#configPath ], {
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
                        ...component.config.nginx,
                        "port": component.config.port,
                        "type": "http",
                    },
                    {
                        ...component.config.nginx,
                        "port": 443,
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
        if ( this.isShuttingDown ) return result( [ 400, `Nginx is shutting down` ] );

        const mutex = this.#mutexSet.get( "test" );

        await mutex.lock();

        const res = await new Promise( resolve => {
            childProcess.execFile(
                "nginx",
                [ "-t", "-c", this.#configPath ],
                {
                    "encoding": "utf8",
                    "maxBuffer": Infinity,
                },
                ( error, stdout, stderr ) => {
                    if ( error ) {
                        resolve( result( [ 400, stderr ] ) );
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
        const id = `${ name }-${ upstreamPort }`;

        return this.#proxies.get( id );
    }

    addProxy ( name, upstreamPort, options ) {
        const id = `${ name }-${ upstreamPort }`;

        var proxy = this.#proxies.get( id );

        if ( proxy ) return proxy;

        proxy = new NginxProxy( this, name, upstreamPort, options );

        this.#proxies.set( id, proxy );

        // reload, if has upstreams
        if ( proxy.hasUpstreams ) this.reload();

        return proxy;
    }

    deleteProxy ( name, upstreamPort ) {
        const id = `${ name }-${ upstreamPort }`;

        const proxy = this.#proxies.get( id );

        if ( !proxy ) return;

        this.#proxies.delete( id );

        proxy.delete();

        this.reload();
    }

    getLocalAddress ( name, port, ssl ) {
        if ( !USE_LOCAL_SOCKET ) {
            const id = name + "/" + port + "/" + ( ssl ? "ssl" : "no-ssl" );

            var address = LISTEB_ADDRESSES[ id ];

            if ( !address ) {
                address = LISTEN_ADDRESS + ":" + LISTEN_PORT++;

                LISTEB_ADDRESSES[ id ] = address;
            }

            return address;
        }
        else {
            return "unix:" + this.getSocketPath( name, port, ssl );
        }
    }

    // XXX
    getSocketPath ( name, port, ssl ) {
        var socketPath = this.app.env.unixSocketsDir + `/nginx-${ name }-${ port }`;

        if ( ssl ) socketPath += "-ssl";

        socketPath += ".socket";

        // XXX https://trac.nginx.org/nginx/ticket/2594#comment:1
        // XXX delete after bug will be closed
        socketPath = "/var/run/" + crypto.createHash( "md5" ).update( socketPath ).digest( "base64url" ) + ".socket";

        return socketPath;
    }

    // private
    #onProcExit ( code, signal ) {
        this.#isStarted = false;

        this.#proc = null;

        this.#docker?.stop();
        this.#docker = null;

        console.log( `Nginx process exited, code: ${ code }` );

        this.#activityCounter.value--;

        process.shutDown( { code } );
    }

    async #updateConfig () {
        const mutex = this.#mutexSet.get( "reload" );

        if ( !mutex.tryLock() ) {
            this.#pendingReload = true;

            return mutex.wait();
        }

        // wait for nginx reloaded
        await sleep( 1000 );

        var config;

        while ( true ) {
            this.#pendingReload = false;

            // remove all configs
            fs.rmSync( this.configsDir, { "recursive": true, "force": true } );

            // create http cache directory
            if ( !fs.existsSync( this.#cacheDir ) ) fs.mkdirSync( this.#cacheDir, { "recursive": true } );

            config = new NginxConfig( this );

            const counter = new Counter();

            // generate servers configs
            for ( const server of config.getServers() ) {
                counter.value++;

                server
                    .writeConfig( {
                        "useRouter": config.useRouter( server.port ),
                    } )
                    .then( () => counter.value-- );
            }

            await counter.wait();

            if ( !this.#pendingReload ) break;
        }

        // generate proxies configs
        for ( const { proxy, options } of config.getProxies() ) {
            proxy.writeConfig( options );
        }

        // generate routers
        for ( const router of config.getRouters() ) {
            this.#writeRouterConfig( router );
        }

        // write default http servers
        for ( const server of config.getDefaultHttpServers() ) {
            this.#writeDefaultHttpServersConfig( server );
        }

        // write nginx config
        this.#writeNginxConfig();

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
    }

    #writeDefaultHttpServersConfig ( server ) {
        const config = defaultHttpServerConfigTemplate.render( {
            "nginx": this,

            "defaultCertificate": this.defaultCertificate.certificate,
            "defaultCertificateKey": this.defaultCertificate.privateKey,

            server,
        } );

        var name = `_default-http-${ server.port }`;
        if ( server.ssl ) name += "-ssl";
        name += ".nginx.conf";

        // deploy nginx config
        fs.mkdirSync( this.configsDir + "/http-servers", { "recursive": true } );
        fs.writeFileSync( this.configsDir + "/http-servers/" + name, config );
    }

    #writeNginxConfig () {

        // generate nginx config
        const config = nginxConfigTemplate.render( {
            "nginx": this,

            "maxBodySize": DigitalSize.new( this.config.maxBodySize ).toNginx(),

            "cacheMaxSize": DigitalSize.new( this.config.cacheMaxSize ).toNginx(),
            "cacheMinFree": DigitalSize.new( this.config.cacheMinFree ).toNginx(),
            "cacheInactive": Interval.new( this.config.cacheInactive ).toNginx(),
            "cacheBypass": this.config.cacheBypass,
        } );

        // deploy nginx config
        fs.mkdirSync( this.configsDir, { "recursive": true } );
        fs.writeFileSync( this.#configPath, config );

        this.#writeSetRealIpFromConfig();
    }

    #writeSetRealIpFromConfig () {
        const setRealIpFrom = [ "# unix socket\nset_real_ip_from    unix:;\n" ];

        for ( const name of SET_REAL_IP_FROM_SUBNETS ) {
            const range = subnets.get( name );

            if ( !range ) continue;

            setRealIpFrom.push( `# ${ name }\n` +
                    range
                        .toJSON()
                        .map( cidr => `set_real_ip_from    ${ cidr };\n` )
                        .join( "" ) );
        }

        fs.writeFileSync( this.#setRealIpfromPath, setRealIpFrom.join( "\n" ) );
    }

    #writeRouterConfig ( router ) {
        const config = reouterConfigTemplate.render( {
            "nginx": this,
            router,
        } );

        fs.mkdirSync( this.configsDir + `/stream-servers`, { "recursive": true } );

        fs.writeFileSync( this.configsDir + `/stream-servers/_router-${ router.port }.nginx.conf`, config );
    }

    #onSubnetsUpdate ( name ) {
        if ( SET_REAL_IP_FROM_SUBNETS.has( name ) ) this.reload();
    }
}
