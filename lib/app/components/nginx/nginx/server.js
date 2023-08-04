import fs from "fs";
import ejs from "#lib/ejs";
import uuidV4 from "#lib/uuid";

const httpConfigTemplate = fs.readFileSync( new URL( "../resources/server.http.nginx.conf", import.meta.url ), "utf8" ),
    streamConfigTemplate = fs.readFileSync( new URL( "../resources/server.stream.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;

    #upstreams;
    #serverNames;
    #upstreamHttpPort;
    #streamPorts;
    #clientMaxBodySize;
    #cacheEnabled;
    #cacheStatus;
    #cacheBypass;

    #upstreamId;
    #httpConfigPath;
    #streamConfigPath;
    #httpConfigInstalled;
    #streamConfigInstalled;
    #deleted;

    constructor ( nginx, id, { upstreams, serverNames, streamPorts, upstreamHttpPort, clientMaxBodySize, cacheEnabled, cacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;

        if ( upstreams && !Array.isArray( upstreams ) ) upstreams = [upstreams];
        this.#upstreams = new Set( upstreams );

        if ( serverNames && !Array.isArray( serverNames ) ) serverNames = [serverNames];
        this.#serverNames = new Set( serverNames );

        if ( streamPorts && !Array.isArray( streamPorts ) ) streamPorts = [streamPorts];
        this.#streamPorts = new Set( streamPorts );

        this.#upstreamHttpPort = upstreamHttpPort || this.#nginx.config.upstreamHttpPort;
        this.#clientMaxBodySize = clientMaxBodySize || this.#nginx.config.clientMaxBodySize;
        this.#cacheEnabled = !this.#nginx.config.cacheEnabled ? false : cacheEnabled ?? this.#nginx.config.cacheEnabled;
        this.#cacheStatus = cacheStatus ?? this.#nginx.config.cacheStatus;
        this.#cacheBypass = cacheBypass ?? this.#nginx.config.cacheBypass;

        this.#upstreamId = uuidV4();

        this.#httpConfigPath = this.#nginx.configsDir + "/" + this.id + ".http.nginx.conf";
        this.#streamConfigPath = this.#nginx.configsDir + "/" + this.id + ".stream.nginx.conf";
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get serverNames () {
        return this.#serverNames;
    }

    get streamPorts () {
        return this.#streamPorts;
    }

    get isInstalled () {
        return this.#httpConfigInstalled || this.#streamConfigInstalled;
    }

    get isDeleted () {
        return this.#deleted;
    }

    // public
    async updateNginxConfigs () {
        const mutex = this.#nginx.updateConfigMutex;

        await mutex.lock();

        const wasInstalled = this.isInstalled,
            httpConfigInstalled = this.#httpConfigInstalled;

        this.#deleteConfigs();

        var res;

        try {
            if ( this.isDeleted ) throw result( [500, `Service deleted`] );

            const defaultServer = this.#serverNames.has( "*" ),
                defaultServerInstalled = this.#nginx.defaultServerImstalled;

            if ( this.#upstreams.size && this.#serverNames.size ) {

                // XXX
                if ( defaultServer ) {
                    if ( defaultServerInstalled ) {
                        this.#nginx.deleteDefaultServer();
                    }

                    // other default http server exists
                    else if ( !httpConfigInstalled ) {
                        throw result( [400, `Default server already exists`] );
                    }
                }

                this.#httpConfigInstalled = true;

                const conf = ejs.render( httpConfigTemplate, {
                    "id": this.#upstreamId,
                    "listenIpFamily": this.#nginx.config.listenIpFamily,
                    "listenDefault": defaultServer,
                    "upstreams": this.#upstreams,
                    "upstreamHttpPort": this.#upstreamHttpPort,
                    "httpPort": this.#nginx.config.httpPort,
                    "serverName": defaultServer ? '""' : [...this.#serverNames].join( " " ),
                    "clientMaxBodySize": this.#clientMaxBodySize,
                    "cacheEnabled": this.#cacheEnabled,
                    "cacheStatus": this.#cacheStatus,
                    "cacheBypass": this.#cacheBypass,
                } );

                // update server config
                fs.writeFileSync( this.#httpConfigPath, conf );
            }

            if ( this.#upstreams.size && this.#streamPorts.size ) {
                this.#streamConfigInstalled = true;

                const conf = ejs.render( streamConfigTemplate, {
                    "id": this.#upstreamId,
                    "listenIpFamily": this.#nginx.config.listenIpFamily,
                    "upstreams": this.#upstreams,
                    "streamPorts": this.#streamPorts,
                } );

                // update server config
                fs.writeFileSync( this.#streamConfigPath, conf );
            }

            if ( !this.isInstalled ) {
                if ( wasInstalled ) this.#nginx.reload();

                res = result( 200 );
            }
            else {
                res = await this.#nginx.test();

                if ( res.ok ) {
                    this.#nginx.reload();
                }
                else {

                    // XXX
                    // restore default server
                    if ( defaultServer && defaultServerInstalled ) this.#nginx.installDefaultServer();

                    this.#deleteConfigs();
                }
            }
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );
        }

        mutex.unlock();

        return res;
    }

    delete () {
        if ( this.#deleted ) return;

        this.#deleted = true;

        this.#deleteConfigs();

        return this.#nginx.deleteServer( this.id );
    }

    async addUpstreams ( upstreams ) {
        if ( this.#deleted ) return result( 200 );

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const added = [];

        for ( const upstream of upstreams ) {
            if ( !this.#upstreams.has( upstream ) ) {
                this.#upstreams.add( upstream );

                added.push( upstream );
            }
        }

        if ( !added.length ) return result( 200 );

        return this.updateNginxConfigs();
    }

    async deleteUpstreams ( upstreams ) {
        if ( this.#deleted ) return result( 200 );

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const deleted = [];

        for ( const upstream of upstreams ) {
            if ( this.#upstreams.has( upstream ) ) {
                this.#upstreams.delete( upstream );

                deleted.push( upstream );
            }
        }

        if ( !deleted.length ) return result( 200 );

        return this.updateNginxConfigs();
    }

    // private
    #deleteConfigs () {
        if ( this.#httpConfigInstalled ) {
            fs.rmSync( this.#httpConfigPath, { "force": true } );

            this.#httpConfigInstalled = false;
        }

        if ( this.#streamConfigInstalled ) {
            fs.rmSync( this.#streamConfigPath, { "force": true } );

            this.#streamConfigInstalled = false;
        }
    }
}
