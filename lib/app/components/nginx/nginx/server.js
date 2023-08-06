import fs from "fs";
import ejs from "#lib/ejs";
import uuidV4 from "#lib/uuid";

const httpConfigTemplate = fs.readFileSync( new URL( "../resources/server.http.nginx.conf", import.meta.url ), "utf8" ),
    streamConfigTemplate = fs.readFileSync( new URL( "../resources/server.stream.nginx.conf", import.meta.url ), "utf8" ),
    defaultServerTemplate = fs.readFileSync( new URL( "../resources/default.http.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;

    #httpPort;
    #upstreams;
    #serverNames;
    #upstreamHttpPort;
    #streamPorts;
    #maxBodySize;
    #cacheEnabled;
    #cacheStatus;
    #cacheBypass;

    #upstreamId;
    #httpConfigPath;
    #streamConfigPath;
    #httpConfigInstalled;
    #streamConfigInstalled;
    #defaultServer = false;
    #deleted;

    constructor ( nginx, id, { httpPort, upstreams, serverNames, streamPorts, upstreamHttpPort, maxBodySize, cacheEnabled, cacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;

        this.#httpPort = httpPort || this.#nginx.config.httpPort;

        if ( upstreams && !Array.isArray( upstreams ) ) upstreams = [upstreams];
        this.#upstreams = new Set( upstreams );

        if ( serverNames && !Array.isArray( serverNames ) ) serverNames = [serverNames];
        this.#serverNames = new Set( serverNames );

        if ( streamPorts && !Array.isArray( streamPorts ) ) streamPorts = [streamPorts];
        this.#streamPorts = new Set( streamPorts );

        this.#upstreamHttpPort = upstreamHttpPort || this.#nginx.config.upstreamHttpPort;
        this.#maxBodySize = maxBodySize || this.#nginx.config.maxBodySize;
        this.#cacheEnabled = !this.#nginx.config.cacheEnabled ? false : cacheEnabled ?? this.#nginx.config.cacheEnabled;
        this.#cacheStatus = cacheStatus ?? this.#nginx.config.cacheStatus;
        this.#cacheBypass = cacheBypass ?? this.#nginx.config.cacheBypass;

        this.#upstreamId = uuidV4();

        if ( this.#serverNames.has( "*" ) ) {
            this.#defaultServer = true;
        }

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

    get httpPort () {
        return this.#httpPort;
    }

    get hasServerNames () {
        return !!this.#serverNames.size;
    }

    get isDefaultServer () {
        return this.#defaultServer;
    }

    get isInstalled () {
        return this.#httpConfigInstalled || this.#streamConfigInstalled;
    }

    get isDeleted () {
        return this.#deleted;
    }

    // public
    // XXX
    async updateNginxConfigs () {
        if ( this.isDeleted ) return result( [500, `Service deleted`] );

        const mutex = this.#nginx.updateConfigMutex;

        await mutex.lock();

        const reload = this.#deleteConfigs(),
            servers = this.#getHttpServers();

        var res;

        try {

            // install http server
            if ( this.#upstreams.size && this.#serverNames.size ) {
                if ( servers.hasDefaultServer ) throw result( [400, `Nginx server ${this.id} default server conglict`] );

                // default server
                if ( !this.isDefaultServer ) {
                    this.#deleteDefaultServer();
                }
                else {
                    this.#installDefaultServer();
                }

                this.#httpConfigInstalled = true;

                const conf = ejs.render( httpConfigTemplate, {
                    "id": this.#upstreamId,
                    "listenIpFamily": this.#nginx.config.listenIpFamily,
                    "defaultServer": this.#defaultServer,
                    "upstreams": this.#upstreams,
                    "upstreamHttpPort": this.#upstreamHttpPort,
                    "httpPort": this.#httpPort,
                    "serverName": this.#defaultServer ? '""' : [...this.#serverNames].join( " " ),
                    "maxBodySize": this.#maxBodySize,
                    "cacheEnabled": this.#cacheEnabled,
                    "cacheStatus": this.#cacheStatus,
                    "cacheBypass": this.#cacheBypass,
                } );

                // update server config
                fs.writeFileSync( this.#httpConfigPath, conf );
            }

            // install stream server
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
                if ( reload ) this.#nginx.reload();

                res = result( 200 );
            }
            else {
                res = await this.#nginx.test();

                // config is valid
                if ( res.ok ) {
                    this.#nginx.reload();
                }

                // config is not valid
                else {
                    this.#deleteConfigs();

                    // restore default server
                    if ( this.isDefaultServer ) {
                        this.#installDefaultServer();
                    }
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

        if ( this.#httpConfigInstalled ) {
            const servers = this.#getHttpServers();

            if ( !servers.hasNonDefaultServers ) {
                if ( !this.isDefaultServer ) this.#deleteDefaultServer();
            }
            else if ( this.isDefaultServer ) {
                this.#installDefaultServer();
            }
        }

        const reload = this.#deleteConfigs();

        if ( reload ) this.#nginx.reload();

        this.#nginx.deleteServer( this.id );
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
        var reload;

        if ( this.#httpConfigInstalled ) {
            reload = true;
            this.#httpConfigInstalled = false;

            fs.rmSync( this.#httpConfigPath, { "force": true } );
        }

        if ( this.#streamConfigInstalled ) {
            reload = true;
            this.#streamConfigInstalled = false;

            fs.rmSync( this.#streamConfigPath, { "force": true } );
        }

        return reload;
    }

    #installDefaultServer () {
        const defaultServerConfigPath = this.#nginx.configsDir + `/_default.${this.#httpPort}.http.nginx.conf`;

        const conf = ejs.render( defaultServerTemplate, {
            "listenIpFamily": this.config.listenIpFamily,
            "httpPort": this.#httpPort,
        } );

        // update server config
        fs.writeFileSync( defaultServerConfigPath, conf );
    }

    #deleteDefaultServer () {
        const defaultServerConfigPath = this.#nginx.configsDir + `/_default.${this.#httpPort}.http.nginx.conf`;

        fs.rmSync( defaultServerConfigPath, { "force": true } );
    }

    #getHttpServers () {
        const res = {
            "hasDefaultServer": false,
            "hasNonDefaultServers": false,
        };

        for ( const server of this.#nginx.servers ) {
            if ( server === this ) continue;

            if ( !server.hasServerNames ) continue;

            if ( server.httpPort !== this.httpPort ) continue;

            if ( server.isDefaultServer ) {
                res.hasDefaultServer = true;
            }
            else {
                res.hasNonDefaultServers = true;
            }
        }

        return res;
    }
}
