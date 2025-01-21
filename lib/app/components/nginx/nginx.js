import childProcess from "node:child_process";
import fs from "node:fs";
import * as certificates from "#lib/certificates";
import DigitalSize from "#lib/digital-size";
import ejs from "#lib/ejs";
import { exists } from "#lib/fs";
import Interval from "#lib/interval";
import IpRange from "#lib/ip/range";
import subnets from "#lib/ip/subnets";
import Counter from "#lib/threads/counter";
import Mutex from "#lib/threads/mutex";
import { sleep } from "#lib/utils";
import NginxConfig from "./nginx/config.js";
import Docker from "./nginx/docker.js";
import NginxProxy from "./nginx/proxy.js";

const nginxConfigTemplate = ejs.fromFile( new URL( "resources/nginx.conf", import.meta.url ) ),
    reouterConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-router.nginx.conf", import.meta.url ) ),
    defaultHttpServerConfigTemplate = ejs.fromFile( new URL( "resources/server.http-default.nginx.conf", import.meta.url ) ),
    defaultTcpServerConfigTemplate = ejs.fromFile( new URL( "resources/server.stream-default.nginx.conf", import.meta.url ) );

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
    #isDestroying = false;
    #pendingReload = false;

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

    get isDestroying () {
        return this.#isDestroying;
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

    get dhParamsPath () {
        return certificates.dhParamsPath;
    }

    // public
    async init () {
        const { certificate, privateKey } = await certificates.createCertificate();

        this.#defaultCertificate = {
            "certificatePath": new this.app.env.TmpFile(),
            "privateKeyPath": new this.app.env.TmpFile(),
        };

        fs.writeFileSync( this.#defaultCertificate.certificatePath.path, certificate );

        fs.writeFileSync( this.#defaultCertificate.privateKeyPath.path, privateKey );

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

        this.#proc.on( "exit", this.#onNginxExit.bind( this ) );

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

    async destroy () {
        this.#isDestroying = true;

        // stop docker watcher
        await this.#docker?.stop();
        this.#docker = null;

        // stop nginx
        return this._stop();
    }

    async reload () {
        return this.#updateConfig();
    }

    async test () {
        if ( this.isDestroying ) return result( [ 400, `Nginx is destroying` ] );

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

    // protected
    async _stop () {
        this.#proc?.kill( "SIGTERM" );

        return this.#activityCounter.wait();
    }

    async _stopGraceful () {
        this.#proc?.kill( "SIGQUIT" );

        return this.#activityCounter.wait();
    }

    _stopWorkersGraceful () {
        this.#proc?.kill( "SIGWINCH" );
    }

    _upgradeExecutable () {
        this.#proc?.kill( "SIGUSR2" );
    }

    _reopenLogFiles () {
        this.#proc?.kill( "SIGUSR1" );
    }

    // private
    #onNginxExit ( code, signal ) {
        this.#isStarted = false;

        this.#proc = null;

        this.#docker?.stop();
        this.#docker = null;

        console.log( `Nginx process exited, code: ${ code }` );

        this.#activityCounter.value--;

        process.destroy( { code } );
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
            if ( !( await exists( this.#cacheDir ) ) ) fs.mkdirSync( this.#cacheDir, { "recursive": true } );

            config = new NginxConfig( this );

            const counter = new Counter();

            await config.generate();

            // generate servers configs
            for ( const [ server, options ] of config.servers ) {
                counter.value++;

                server.writeConfig( options ).then( () => counter.value-- );
            }

            await counter.wait();

            if ( !this.#pendingReload ) break;
        }

        // generate proxies configs
        for ( const { proxy, options } of config.proxies ) {
            proxy.writeConfig( options );
        }

        // generate routers
        for ( const router of config.routers ) {
            this.#writeRouterConfig( router );
        }

        // write default servers
        for ( const server of config.defaultHttpServers ) {
            if ( server.type === "http" ) {
                this.#writeDefaultHttpServerConfig( server );
            }
            else if ( server.type === "tcp" ) {
                this.#writeDefaultTcpServerConfig( server );
            }
        }

        // write nginx config
        this.#writeNginxConfig();

        this.#proc?.kill( "SIGHUP" );

        mutex.unlock();
    }

    #writeDefaultHttpServerConfig ( server ) {
        const config = defaultHttpServerConfigTemplate.render( {
            "nginx": this,
            server,
        } );

        var name = `_default-http-${ server.port }`;
        if ( server.ssl ) name += "-ssl";
        name += ".nginx.conf";

        // deploy nginx config
        fs.mkdirSync( this.configsDir + "/http-servers", { "recursive": true } );
        fs.writeFileSync( this.configsDir + "/http-servers/" + name, config );
    }

    #writeDefaultTcpServerConfig ( server ) {
        const config = defaultTcpServerConfigTemplate.render( {
            "nginx": this,
            server,
        } );

        var name = `_default-tcp-${ server.port }`;
        if ( server.ssl ) name += "-ssl";
        name += ".nginx.conf";

        // deploy nginx config
        fs.mkdirSync( this.configsDir + "/stream-servers", { "recursive": true } );
        fs.writeFileSync( this.configsDir + "/stream-servers/" + name, config );
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
