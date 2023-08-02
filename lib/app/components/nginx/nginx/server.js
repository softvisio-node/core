import fs from "fs";
import ejs from "#lib/ejs";
import fetch from "#lib/fetch";

const vhostTemplate = fs.readFileSync( new URL( "../resources/templates/vhost.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #serverNames;
    #streamPorts;
    #clientMaxBodySize;
    #cacheEnabled;
    #cacheStatus;
    #cacheBypass;
    #vhostHttpPath;
    #upstreams = new Set();
    #deleted;

    constructor ( nginx, id, { serverNames, streamPorts, clientMaxBodySize, cacheEnabled, cacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#serverNames = new Set( serverNames );
        this.#streamPorts = new Set( streamPorts );
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#cacheStatus = cacheStatus;
        this.#cacheBypass = cacheBypass;

        this.#vhostHttpPath = this.#nginx.vhostsDir + "/" + this.id + ".http.nginx.conf";

        this.#installVhost();
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get streamPorts () {
        return this.#streamPorts;
    }

    get id () {
        return this.#id;
    }

    get serverNames () {
        return this.#serverNames;
    }

    get isDeleted () {
        return this.#deleted;
    }

    // public
    delete () {
        if ( this.#deleted ) return;

        this.#deleted = true;

        fs.rmSync( this.#vhostHttpPath, { "force": true } );

        this.#nginx.deleteServer( this.id );
    }

    async addUpstreams ( upstreams ) {
        if ( this.#deleted ) return;

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const added = [];

        for ( const upstream of upstreams ) {
            if ( !this.#upstreams.has( upstream ) ) {
                this.#upstreams.add( upstream );

                added.push( upstream );
            }
        }

        if ( !added.length ) return;

        return this.#syncUpstreams( "add", added );
    }

    async deleteUpstreams ( upstreams ) {
        if ( this.#deleted ) return;

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const deleted = [];

        for ( const upstream of upstreams ) {
            if ( this.#upstreams.has( upstream ) ) {
                this.#upstreams.delete( upstream );

                deleted.push( upstream );
            }
        }

        if ( !deleted.length ) return;

        return this.#syncUpstreams( "remove", deleted );
    }

    async syncUpstreams () {
        if ( !this.#upstreams.size ) return;

        return this.#syncUpstreams( "add", this.#upstreams );
    }

    // private
    #installVhost () {
        const conf = ejs.render( vhostTemplate, {
            "id": this.id,
            "listenIpFamily": this.#nginx.config.listenIpFamily,
            "httpPort": this.#nginx.config.httpPort,
            "serverName": [...this.#serverNames].join( " " ),
            "streamPorts": this.#streamPorts,
            "clientMaxBodySize": this.clientMaxBodySize,
            "cacheEnabled": this.#cacheEnabled,
            "cacheStatus": this.#cacheStatus,
            "cacheBypass": this.#cacheBypass,
        } );

        // update vhost
        fs.writeFileSync( this.#vhostHttpPath, conf );
    }

    async #syncUpstreams ( operation, upstreams ) {
        if ( this.#deleted ) return;

        if ( this.#nginx.isReloading ) return;

        const promises = [];

        for ( const upstream of upstreams ) {
            const server = upstream + ":80";

            promises.push( fetch( `http://127.0.0.1:${this.#nginx.config.httpPort}/dynamic-upstream?upstream=${this.id}-${this.#nginx.config.httpPort}&${operation}=&server=${server}`, {
                "headers": {
                    "host": "dynamic-upstream",
                },
            } ).then( res => console.log( `Server ${this.id}, add upstream: ${server} ... ${res}` ) ) );

            for ( const streamPort of this.#streamPorts ) {
                const server = upstream + ":" + streamPort;

                promises.push( fetch( `http://127.0.0.1:${this.#nginx.config.httpPort}/dynamic-upstream?upstream=${this.id}-${streamPort}&${operation}=&server=${server}&stream=`, {
                    "headers": {
                        "host": "dynamic-upstream",
                    },
                } ).then( res => console.log( `Server ${this.id}, add upstream: ${server} ... ${res}` ) ) );
            }
        }

        return Promise.all( promises );
    }
}
