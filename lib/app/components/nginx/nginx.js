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
import { sleep } from "#lib/utils";
import certificates from "#lib/certificates";
import IpRange from "#lib/ip/range";

const nginxConfigTemplate = ejs.fromFile( new URL( "resources/nginx.conf", import.meta.url ) ),
    reouterConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-router.nginx.conf", import.meta.url ) ),
    defaultHttpServerConfigTemplate = ejs.fromFile( new URL( "resources/server.http-default.nginx.conf", import.meta.url ) );

// XXX remove
var USE_LOCAL_SOCKET = false,
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
    #setRealIpFromPath;

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

    #setRealIpFromSubnets;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dataDir = this.#app.env.dataDir + "/nginx";

        this.#cacheDir ??= this.#dataDir + "/cache";

        this.#configsDir = this.app.env.tmpDir + "/nginx";

        this.#configPath ??= this.#configsDir + "/nginx.conf";

        this.#setRealIpFromPath = this.#configsDir + "/set-real-ip-from.nginx.conf";

        process.on( "exit", () => this.#proc?.kill( "SIGTERM" ) );

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

    get setRealIpFromPath () {
        return this.#setRealIpFromPath;
    }

    get acme () {
        return this.#acme;
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

        // init db
        if ( this.app.dbh ) {
            res = await this.app.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;
        }

        const { certificate, privateKey } = await certificates.createCertificate();

        this.#defaultCertificate = {
            "certificate": new this.app.env.TmpFile(),
            "privateKey": new this.app.env.TmpFile(),
        };

        fs.writeFileSync( this.#defaultCertificate.certificate + "", certificate );

        fs.writeFileSync( this.#defaultCertificate.privateKey + "", privateKey );

        // init acme
        this.#acme = new Acme( this );

        res = await this.#acme.init();
        if ( !res.ok ) return res;

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

    // XXX remove
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
            let socketPath = "unix:" + this.app.env.unixSocketsDir + `/nginx-${ name }-${ port }`;

            if ( ssl ) socketPath += "-ssl";

            socketPath += ".socket";

            return socketPath;
        }
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
            for ( const [ server, options ] of config.getServers() ) {
                counter.value++;

                server.writeConfig( options ).then( () => counter.value-- );
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
            this.#writeDefaultHttpServerConfig( server );
        }

        // write nginx config
        this.#writeNginxConfig();

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
    }

    #writeDefaultHttpServerConfig ( server ) {
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
        this.#setRealIpFromSubnets = new Set();

        fs.writeFileSync( this.#setRealIpFromPath, this.#buildSetRealIpFrom( this.#config.setRealIpFrom ) );
    }

    #buildSetRealIpFrom ( config ) {
        const setRealIpFrom = [ "# unix socket\nset_real_ip_from    unix:;\n" ];

        const ranges = {};

        if ( config?.length ) {
            for ( const subnet of config ) {
                if ( IpRange.isValid( subnet ) ) {
                    ranges.custom ||= [];

                    ranges.custom.push( subnet );
                }
                else {
                    this.#setRealIpFromSubnets.add( subnet );

                    const range = subnets.get( subnet )?.toJSON();

                    if ( !range?.length ) continue;

                    ranges[ subnet ] = range;
                }
            }
        }

        for ( const range of Object.keys( ranges ).sort() ) {
            setRealIpFrom.push( `# ${ range }\n` + ranges[ range ].map( cidr => `set_real_ip_from    ${ cidr };\n` ).join( "" ) );
        }

        return setRealIpFrom.join( "\n" );
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
        if ( this.#setRealIpFromSubnets?.has( name ) ) this.reload();
    }
}
