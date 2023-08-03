import fs from "fs";
import ejs from "#lib/ejs";
import uuidV4 from "#lib/uuid";

const httpConfigTemplate = fs.readFileSync( new URL( "../resources/templates/server.http.nginx.conf", import.meta.url ), "utf8" ),
    streamConfigTemplate = fs.readFileSync( new URL( "../resources/templates/server.stream.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #serverNames;
    #upstreamHttpPort;
    #streamPorts;
    #clientMaxBodySize;
    #cacheEnabled;
    #cacheStatus;
    #cacheBypass;
    #httpConfigPath;
    #streamConfigPath;
    #upstreamId;
    #upstreams;
    #deleted;
    #httpConfigInstalled;
    #streamConfigInstalled;

    constructor ( nginx, id, { serverNames, upstreamHttpPort, streamPorts, clientMaxBodySize, cacheEnabled, cacheStatus, cacheBypass, upstreams } = {} ) {
        this.#nginx = nginx;
        this.#id = id;

        if ( serverNames && !Array.isArray( serverNames ) ) serverNames = [serverNames];
        this.#serverNames = new Set( serverNames );

        this.#upstreamHttpPort = upstreamHttpPort || 80;

        if ( streamPorts && !Array.isArray( streamPorts ) ) streamPorts = [streamPorts];
        this.#streamPorts = new Set( streamPorts );

        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#cacheStatus = cacheStatus;
        this.#cacheBypass = cacheBypass;

        if ( upstreams && !Array.isArray( upstreams ) ) upstreams = [upstreams];
        this.#upstreams = new Set( upstreams );

        this.#httpConfigPath = this.#nginx.configsDir + "/" + this.id + ".http.nginx.conf";
        this.#streamConfigPath = this.#nginx.configsDir + "/" + this.id + ".stream.nginx.conf";

        this.#upstreamId = uuidV4();
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

        const wasInstalled = this.isInstalled;

        this.#deleteConfigs();

        if ( this.isDeleted ) return result( 500 );

        if ( this.#serverNames.size ) {
            this.#httpConfigInstalled = true;

            const conf = ejs.render( httpConfigTemplate, {
                "id": this.#upstreamId,
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreams": this.#upstreams,
                "upstreamHttpPort": this.#upstreamHttpPort,
                "httpPort": this.#nginx.config.httpPort,
                "serverName": [...this.#serverNames].join( " " ),
                "clientMaxBodySize": this.#clientMaxBodySize,
                "cacheEnabled": this.#cacheEnabled,
                "cacheStatus": this.#cacheStatus,
                "cacheBypass": this.#cacheBypass,
            } );

            // update server config
            fs.writeFileSync( this.#httpConfigPath, conf );
        }

        if ( this.#streamPorts.size ) {
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

        var res;

        if ( !wasInstalled || !this.isInstalled ) {
            res = result( 200 );
        }
        else {
            res = await this.#nginx.test();

            if ( res.ok ) {
                await this.#nginx.reload();
            }
            else {
                console.log( `Nginx server ${this.id} config error: ${res}` );

                this.#deleteConfigs();
            }
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
