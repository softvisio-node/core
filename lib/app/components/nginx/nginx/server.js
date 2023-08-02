import fs from "fs";
import ejs from "#lib/ejs";
import fetch from "#lib/fetch";

const vhostTemplate = fs.readFileSync( new URL( "../resources/templates/vhost.http.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #names;
    #streamPorts;
    #clientMaxBodySize;
    #cacheEnabled;
    #upstreamCacheStatus;
    #cacheBypass;
    #vhostHttpPath;
    #upstreams = new Set();
    #deleted;

    constructor ( nginx, id, { names, streamPorts, clientMaxBodySize, cacheEnabled, upstreamCacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#names = names;
        this.#streamPorts = new Set( streamPorts );
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#upstreamCacheStatus = upstreamCacheStatus;
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

    get names () {
        return this.#names;
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

        if ( added.length ) {
            await this.#addUpstreams( added );
        }
    }

    async deleteUpstreams ( upstreams ) {
        if ( this.#deleted ) return;

        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const deleteed = [];

        for ( const upstream of upstreams ) {
            if ( this.#upstreams.has( upstream ) ) {
                this.#upstreams.delete( upstream );

                deleteed.push( upstream );
            }
        }

        if ( this.#nginx.isReloading ) return;

        for ( const upstream of deleteed ) {
            const server = upstream + ":80";

            const res = await fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-${this.#nginx.config.httpPort}&remove=&server=${server}` );

            console.log( `Server ${this.id}, remove upstream: ${server} ... ${res}` );
        }
    }

    async syncUpstreams () {
        if ( this.#upstreams.size ) {
            await this.#addUpstreams( this.#upstreams );
        }
    }

    // private
    #installVhost () {
        const conf = ejs.render( vhostTemplate, {
            "id": this.id,
            "listenIpFamily": this.#nginx.config.listenIpFamily,
            "port": this.#nginx.config.httpPort,
            "serverName": this.#names.join( " " ),
            "clientMaxBodySize": this.clientMaxBodySize,
            "cacheEnabled": this.#cacheEnabled,
            "upstreamCacheStatus": this.#upstreamCacheStatus,
            "cacheBypass": this.#cacheBypass,
        } );

        // update vhost
        fs.writeFileSync( this.#vhostHttpPath, conf );
    }

    async #addUpstreams ( upstreams ) {
        if ( this.#deleted ) return;

        if ( this.#nginx.isReloading ) return;

        const promises = [];

        for ( const upstream of upstreams ) {
            const server = upstream + ":80";

            fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-${this.#nginx.config.httpPort}&add=&server=${server}` ).then( res => console.log( `Server ${this.id}, add upstream: ${server} ... ${res}` ) );

            for ( const streamPort of this.#streamPorts ) {
                const server = upstream + ":" + streamPort;

                fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-${streamPort}&add=&server=${server}&stream=` ).then( res => console.log( `Server ${this.id}, add upstream: ${server} ... ${res}` ) );
            }
        }

        return Promise.all( promises );
    }
}
