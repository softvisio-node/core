import fs from "fs";
import ejs from "#lib/ejs";
import DnsWatcher from "#lib/dns/watcher";
import fetch from "#lib/fetch";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import { validateNginxSizeValue, validateNginxDurationValue } from "./validator.js";

const ajv = new Ajv();

ajv.addFormat( "nginx-size", {
    "type": "string",
    "validate": validateNginxSizeValue,
} );

ajv.addFormat( "nginx-duration", {
    "type": "string",
    "validate": validateNginxDurationValue,
} );

const optionsValidator = ajv.compile( readConfig( new URL( "resources/schemas/service-options.schema.yaml", import.meta.url ) ) );

const RESERVED_PORTS = new Set( [80, 443] );

export default class NginxService {
    #nginx;
    #id;
    #hostname;
    #name;
    #isHttpEnabled = false;
    #isStreamEnabled = false;
    #options;
    #isRemoved;
    #nginxReloadListener;
    #httpServerName = new Set();
    #streamPort = new Set();
    #dnsWatcher;

    constructor ( nginx, id, name, { hostname } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#name = name;
        this.#hostname = hostname;
        this.#nginxReloadListener = this.#onNginxReload.bind( this );

        // listen for "reload" event
        this.#nginx.maxListeners++;
        this.#nginx.on( "reload", this.#nginxReloadListener );

        if ( this.#hostname ) {
            this.#dnsWatcher = new DnsWatcher( this.#hostname, {
                "family": this.#nginx.config.listenIpFamily,
                "minInterval": 1000,
                "maxInterval": 60000,
                "step": 5000,
            } )
                .on( "add", this.#updatePeers.bind( this, "add" ) )
                .on( "delete", this.#updatePeers.bind( this, "remove" ) );
        }
    }

    // properties
    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get hostname () {
        return this.#hostname;
    }

    get isRemoved () {
        return this.#isRemoved;
    }

    get isEnabled () {
        return this.#isHttpEnabled || this.#isStreamEnabled;
    }

    get vhostHttpPath () {
        return this.#nginx.vhostsDir + "/" + this.id + ".http.nginx.conf";
    }

    get vhostStreamPath () {
        return this.#nginx.vhostsDir + "/" + this.id + ".stream.nginx.conf";
    }

    get vhostCachePath () {
        return this.#nginx.cacheDir + "/" + this.id;
    }

    // public
    update ( options = {} ) {
        if ( this.#isRemoved ) return;

        // coerce options
        options.httpCacheEnabled = !!options.httpCacheEnabled;
        options.httpUpstreamCacheStatus = !!options.httpUpstreamCacheStatus;
        options.httpProxyCacheBypass = !!options.httpProxyCacheBypass;

        // validate options
        if ( !optionsValidator( options ) ) {
            console.log( `Options for ${this.name} are invalid:\n${JSON.stringify( options, null, 4 )}\n${optionsValidator.errors}` );

            return;
        }

        var updated;

        // validate server name
        if ( !Array.isArray( options.httpServerName ) ) options.httpServerName = [options.httpServerName];
        options.httpServerName = options.httpServerName.reduce( ( res, name ) => {
            ERROR: if ( typeof name === "string" ) {
                name = name.trim();

                if ( !name ) break ERROR;

                for ( const service of Object.values( this.#nginx.services ) ) {
                    if ( service.id === this.id ) continue;

                    if ( service.hasHttpServerName( name ) ) {
                        console.log( `Server name "${name}" is already used` );

                        break ERROR;
                    }
                }

                res.push( name );
            }

            return res;
        }, [] );
        options.httpServerName = options.httpServerName.sort();

        // validate stream port
        if ( !Array.isArray( options.streamPort ) ) options.streamPort = [options.streamPort];
        options.streamPort = options.streamPort.reduce( ( res, port ) => {
            ERROR: if ( port ) {
                if ( RESERVED_PORTS.has( port ) ) break ERROR;

                for ( const service of Object.values( this.#nginx.services ) ) {
                    if ( service.id === this.id ) continue;

                    if ( service.hasStreamPort( port ) ) {
                        console.log( `Stream port "${port}" is already used` );

                        break ERROR;
                    }
                }

                res.push( port );
            }

            return res;
        }, [] );
        options.streamPort = options.streamPort.sort();

        // compare options
        if ( !this.#options || JSON.stringify( this.#options ) !== JSON.stringify( options ) ) {
            updated = true;

            this.#options = options;
        }

        if ( !updated ) return;

        this.#log( "updated", JSON.stringify( options, null, 4 ) );

        this.#options = { ...options };

        this.#httpServerName = new Set( options.httpServerName.sort() );
        this.#isHttpEnabled = !!this.#httpServerName.size;

        this.#streamPort = new Set( options.streamPort.sort() );
        this.#isStreamEnabled = !!this.#streamPort.size;

        // generate http config
        if ( this.#isHttpEnabled ) {
            const conf = ejs.render( fs.readFileSync( new URL( "resources/templates/vhost.http.nginx.conf", import.meta.url ), "utf8" ), {
                "id": this.id,
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreamServer": this.#hostname,

                "port": this.#nginx.config.httpPort,
                "serverName": [...this.#httpServerName].join( " " ),
                "clientMaxBodySize": this.#options.httpClientMaxBodySize,
                "cacheDir": this.#nginx.cacheDir,
                "cacheEnabled": this.#options.httpCacheEnabled,
                "cacheMaxSize": this.#options.httpCacheMaxSize,
                "cacheInactive": this.#options.httpCacheInactive,
                "httpUpstreamCacheStatus": options.httpUpstreamCacheStatus,
                "httpProxyCacheBypass": options.httpProxyCacheBypass,
            } );

            // update vhost
            fs.writeFileSync( this.vhostHttpPath, conf );
        }
        else {
            this.#removeHttpVhost();

            // this.#removeHttpCache();
        }

        // generate stream config
        if ( this.#isStreamEnabled ) {
            const conf = ejs.render( fs.readFileSync( new URL( "resources/templates/vhost.stream.nginx.conf", import.meta.url ), "utf8" ), {
                "id": this.id,
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreamServer": this.#hostname,

                "streamPorts": [...this.#streamPort],
            } );

            // update vhost
            fs.writeFileSync( this.vhostStreamPath, conf );
        }
        else {
            this.#removeStreamVhost();
        }

        // reload nginx
        this.#nginx.reload();

        // manage upstreams updater
        if ( this.isEnabled ) {
            this.#dnsWatcher?.restart();
        }
        else {
            this.#dnsWatcher?.stop();
        }
    }

    async updateUpstreams () {
        if ( this.#nginx.isReloading || !this.isEnabled ) return;

        this.#dnsWatcher?.lookup( { "force": true } );
    }

    remove () {
        if ( this.#isRemoved ) return;

        this.#isRemoved = true;

        this.#log( `removed` );

        this.#dnsWatcher?.stop();

        this.#nginx.off( "reload", this.#nginxReloadListener );
        this.#nginxReloadListener = null;

        var reload;

        if ( this.#removeHttpVhost() ) reload = true;

        if ( this.#removeStreamVhost() ) reload = true;

        this.#removeHttpCache();

        // reload nginx
        if ( reload ) this.#nginx.reload();
    }

    hasHttpServerName ( name ) {
        return this.#httpServerName.has( name );
    }

    hasStreamPort ( port ) {
        return this.#streamPort.has( port );
    }

    // private
    #onNginxReload () {
        this.#dnsWatcher.reset();
    }

    #removeHttpVhost () {
        var removed = false;

        if ( fs.existsSync( this.vhostHttpPath ) ) {
            fs.rmSync( this.vhostHttpPath, { "force": true } );

            removed = true;
        }

        return removed;
    }

    #removeStreamVhost () {
        var removed = false;

        if ( fs.existsSync( this.vhostStreamPath ) ) {
            fs.rmSync( this.vhostStreamPath, { "force": true } );

            removed = true;
        }

        return removed;
    }

    #removeHttpCache () {
        var removed = false;

        if ( fs.existsSync( this.vhostCachePath ) ) {
            fs.rmSync( this.vhostCachePath, { "recursive": true, "force": true } );

            removed = true;
        }

        return removed;
    }

    async #updatePeers ( type, addresses ) {
        if ( this.#nginx.isReloading ) return;

        for ( const address of addresses ) {
            if ( this.#isHttpEnabled ) {
                const peer = address + ":80";

                const res = await fetch( `http://127.0.0.1:8080/dynamic-upstream?upstream=${this.id}-80&${type}=&server=${peer}` );

                this.#log( `${type} peer`, peer, res + "" );
            }

            if ( this.#isStreamEnabled ) {
                for ( const port of this.#streamPort ) {
                    const peer = address + ":" + port;

                    const res = await fetch( `http://127.0.0.1:8080/dynamic-upstream?upstream=${this.id}-${port}&${type}=&server=${peer}&stream=` );

                    this.#log( `${type} peer`, peer, res + "" );
                }
            }
        }
    }

    #log ( ...args ) {
        args.unshift( `Service: ${this.name}` );

        console.log( args.join( ", " ) );
    }
}
