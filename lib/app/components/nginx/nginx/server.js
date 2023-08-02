import Events from "#lib/events";
import fs from "fs";
import ejs from "#lib/ejs";
import fetch from "#lib/fetch";

const vhostTemplate = fs.readFileSync( new URL( "../resources/templates/vhost.http.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer extends Events {
    #nginx;
    #id;
    #names;
    #clientMaxBodySize;
    #cacheEnabled;
    #upstreamCacheStatus;
    #cacheBypass;
    #vhostHttpPath;
    #started = false;
    #upstreams = new Set();

    constructor ( nginx, id, names, { clientMaxBodySize, cacheEnabled, upstreamCacheStatus, cacheBypass } = {} ) {
        super();

        this.#nginx = nginx;
        this.#id = id;
        this.#names = names;
        this.#clientMaxBodySize = clientMaxBodySize;
        this.#cacheEnabled = cacheEnabled;
        this.#upstreamCacheStatus = upstreamCacheStatus;
        this.#cacheBypass = cacheBypass;

        this.#vhostHttpPath = this.#nginx.vhostsDir + "/" + this.id + ".http.nginx.conf";

        this.#nginx.on( "reload", this.#syncUpstreams() );
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

    get isStarted () {
        return this.#started;
    }

    // public
    start () {
        if ( this.#started ) return result( 200 );

        this.#started = true;

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

        this.emit( "start" );

        return result( 200 );
    }

    stop () {
        if ( !this.#started ) return result( 200 );

        this.#started = false;

        fs.rmSync( this.#vhostHttpPath, { "force": true } );

        this.emit( "stop" );

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

        if ( added.length ) {
            await this.#addUpstreams( added );
        }
    }

    async deleteUpstreams ( upstreams ) {
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

    // private
    async #syncUpstreams () {
        if ( this.#nginx.isReloading ) return;

        if ( this.#upstreams.size ) {
            await this.#addUpstreams( this.#upstreams );
        }
    }

    async #addUpstreams ( upstreams ) {
        for ( const upstream of upstreams ) {
            const server = upstream + ":80";

            const res = await fetch( `http://127.0.0.1:${this.#nginx.config.dynamicUpstreamsPort}/dynamic-upstream?upstream=${this.id}-${this.#nginx.config.httpPort}&add=&server=${server}` );

            console.log( `Server ${this.id}, add upstream: ${server} ... ${res}` );
        }
    }
}
