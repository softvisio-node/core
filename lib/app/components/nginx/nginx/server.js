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
    #installed;
    #deleted;

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

    get isDeleted () {
        return this.#deleted;
    }

    // public
    // XXX
    async install () {
        this.#upstreamId ??= uuidV4();

        if ( !this.#upstreams.size ) return result( 200 );

        if ( this.#serverNames.size ) {
            const conf = ejs.render( httpConfigTemplate, {
                "id": this.#upstreamId,
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreams": this.#upstreams,
                "upstreamHttpPort": this.#upstreamHttpPort,
                "httpPort": this.#nginx.config.httpPort,
                "serverName": [...this.#serverNames].join( " " ),
                "streamPorts": this.#streamPorts,
                "clientMaxBodySize": this.#clientMaxBodySize,
                "cacheEnabled": this.#cacheEnabled,
                "cacheStatus": this.#cacheStatus,
                "cacheBypass": this.#cacheBypass,
            } );

            // update server config
            fs.writeFileSync( this.#httpConfigPath, conf );
        }

        if ( this.#streamPorts.size ) {
            const conf = ejs.render( streamConfigTemplate, {
                "id": this.#upstreamId,
                "listenIpFamily": this.#nginx.config.listenIpFamily,
                "upstreams": this.#upstreams,
                "upstreamHttpPort": this.#upstreamHttpPort,
                "httpPort": this.#nginx.config.httpPort,
                "serverName": [...this.#serverNames].join( " " ),
                "streamPorts": this.#streamPorts,
                "clientMaxBodySize": this.#clientMaxBodySize,
                "cacheEnabled": this.#cacheEnabled,
                "cacheStatus": this.#cacheStatus,
                "cacheBypass": this.#cacheBypass,
            } );

            // update server config
            fs.writeFileSync( this.#streamConfigPath, conf );
        }

        await this.#nginx.reload();

        return result( 200 );
    }

    delete () {
        if ( this.#deleted ) return;

        this.#deleted = true;

        fs.rmSync( this.#httpConfigPath, { "force": true } );
        fs.rmSync( this.#streamConfigPath, { "force": true } );

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

        return this.install();
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

        return this.install();
    }
}
