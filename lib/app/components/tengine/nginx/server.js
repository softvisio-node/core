import fs from "fs";
import ejs from "#lib/ejs";
import uuidV4 from "#lib/uuid";

const httpConfigTemplate = fs.readFileSync( new URL( "../resources/server.http.nginx.conf", import.meta.url ), "utf8" ),
    streamConfigTemplate = fs.readFileSync( new URL( "../resources/server.stream.nginx.conf", import.meta.url ), "utf8" );

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
    async updateNginxConfigs () {
        const mutex = this.#nginx.updateConfigMutex;

        await mutex.lock();

        const wasInstalled = this.isInstalled;

        this.#deleteConfigs();

        var res;

        try {
            if ( this.isDeleted ) throw result( [500, `Service deleted`] );

            // install http server
            if ( this.#upstreams.size && this.#serverNames.size ) {

                // default server

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
                if ( wasInstalled ) this.#nginx.reload();

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
