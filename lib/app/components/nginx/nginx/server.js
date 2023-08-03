import fs from "fs";
import ejs from "#lib/ejs";
import fetch from "#lib/fetch";
import uuidV4 from "#lib/uuid";

const configTemplate = fs.readFileSync( new URL( "../resources/templates/server.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #serverNames;
    #httpPort;
    #streamPorts;
    #clientMaxBodySize;
    #cacheEnabled;
    #cacheStatus;
    #cacheBypass;
    #configPath;
    #upstreamId;
    #upstreams = new Set();
    #deleted;

    constructor ( nginx, id, { serverNames, httpPort, streamPorts, clientMaxBodySize, cacheEnabled, cacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#serverNames = new Set( serverNames );
        this.#httpPort = httpPort || nginx.config.httpPort;
        this.#streamPorts = new Set( streamPorts );
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#cacheStatus = cacheStatus;
        this.#cacheBypass = cacheBypass;

        this.#configPath = this.#nginx.configsDir + "/" + this.id + ".nginx.conf";
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
    install () {
        this.#upstreamId ??= uuidV4();

        const conf = ejs.render( configTemplate, {
            "id": this.#upstreamId,
            "listenIpFamily": this.#nginx.config.listenIpFamily,
            "httpPort": this.#nginx.config.httpPort,
            "serverName": [...this.#serverNames].join( " " ),
            "streamPorts": this.#streamPorts,
            "clientMaxBodySize": this.#clientMaxBodySize,
            "cacheEnabled": this.#cacheEnabled,
            "cacheStatus": this.#cacheStatus,
            "cacheBypass": this.#cacheBypass,
        } );

        // update server config
        fs.writeFileSync( this.#configPath, conf );
    }

    delete () {
        if ( this.#deleted ) return;

        this.#deleted = true;

        fs.rmSync( this.#configPath, { "force": true } );

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

        return this.#syncUpstreams( "add", added );
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

        return this.#syncUpstreams( "remove", deleted );
    }

    async syncUpstreams () {
        if ( !this.#upstreams.size ) return;

        return this.#syncUpstreams( "add", this.#upstreams );
    }

    // private
    // XXX
    async #syncUpstreams ( operation, upstreams ) {
        if ( this.#deleted ) return result( 200 );

        if ( this.#nginx.isReloading ) return result( 200 );

        const promises = [];

        const httpPort = this.#httpPort;

        for ( const upstream of upstreams ) {
            const upstreamName = this.#upstreamId + "-" + httpPort,
                server = upstream + ":80";

            promises.push( fetch( `http://127.0.0.1:${httpPort}/?${operation}=&upstream=${upstreamName}&server=${server}`, {
                "headers": {
                    "host": "dynamic-upstream",
                },
            } ).then( res => console.log( `Nginx server ${this.id}, ${operation} upstream: ${server} ... ${res}` ) ) );

            for ( const streamPort of this.#streamPorts ) {
                const upstreamName = this.#upstreamId + "-" + streamPort,
                    server = upstream + ":" + streamPort;

                promises.push( fetch( `http://127.0.0.1:${httpPort}/?${operation}=&upstream=${upstreamName}&server=${server}&stream=`, {
                    "headers": {
                        "host": "dynamic-upstream",
                    },
                } ).then( res => console.log( `Nginx server ${this.id}, ${operation} strem upstream: ${server} ... ${res}` ) ) );
            }
        }

        // XXX result
        await Promise.all( promises );

        return result( 200 );
    }
}
