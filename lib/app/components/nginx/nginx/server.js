import fs from "fs";
import ejs from "#lib/ejs";

const vhostTemplate = fs.readFileSync( new URL( "../resources/templates/vhost.http.nginx.conf", import.meta.url ), "utf8" );

export default class NginxServer {
    #nginx;
    #id;
    #names;
    #vhostHttpPath;
    #clientMaxBodySize;
    #cacheEnabled;
    #upstreamCacheStatus;
    #cacheBypass;

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

            // upstreamServer: this.#hostname,

            "port": this.#nginx.config.httpPort,
            "serverName": this.#names.join( " " ),
            "clientMaxBodySize": this.clientMaxBodySize,

            // cacheDir: this.#nginx.cacheDir,
            // cacheEnabled: this.#options.httpCacheEnabled,
            // cacheMaxSize: this.#options.httpCacheMaxSize,
            // cacheInactive: this.#options.httpCacheInactive,
            // httpUpstreamCacheStatus: options.httpUpstreamCacheStatus,
            // httpProxyCacheBypass: options.httpProxyCacheBypass,
        } );

        // update vhost
        fs.writeFileSync( this.#vhostHttpPath, conf );

        return result( 200 );
    }

    stop () {
        fs.rmSync( this.#vhostHttpPath, { "force": true } );

        return result( 200 );
    }

    addUpstreams ( upstreams ) {}

    deleteUpstreams ( upstreams ) {}
}
