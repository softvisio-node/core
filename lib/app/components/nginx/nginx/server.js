import fs from "fs";
import ejs from "#lib/ejs";
import fetch from "#lib/fetch";

const vhostTemplate = fs.readFileSync( new URL( "../resources/templates/vhost.http.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #names;
    #clientMaxBodySize;
    #cacheEnabled;
    #upstreamCacheStatus;
    #cacheBypass;
    #vhostHttpPath;
    #upstreams = new Set();

    constructor ( nginx, id, names, { clientMaxBodySize, cacheEnabled, upstreamCacheStatus, cacheBypass } = {} ) {
        this.#nginx = nginx;
        this.#id = id;
        this.#names = names;
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#upstreamCacheStatus = upstreamCacheStatus;
        this.#cacheBypass = cacheBypass;

        this.#vhostHttpPath = this.#nginx.vhostsDir + "/" + this.id + ".http.nginx.conf";
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get names () {
        return this.#names;
    }

    // public
    start () {
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

        return result( 200 );
    }

    stop () {
        fs.rmSync( this.#vhostHttpPath, { "force": true } );

        return result( 200 );
    }

    async addUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const added = [];

        for ( const upstream of upstreams ) {
            if ( !this.#upstreams.has( upstream ) ) {
                this.#upstreams.add( upstream );

                added.push( upstream );
            }
        }

        if ( this.#nginx.isReloading ) return;

        for ( const upstream of added ) {
            await fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-80&add=&server=${upstream}` );
        }
    }

    async deleteUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

        const removed = [];

        for ( const upstream of upstreams ) {
            if ( !this.#upstreams.has( upstream ) ) {
                this.#upstreams.add( upstream );

                removed.push( upstream );
            }
        }

        if ( this.#nginx.isReloading ) return;

        for ( const upstream of removed ) {
            await fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-80&remove=&server=${upstream}` );
        }
    }
}
