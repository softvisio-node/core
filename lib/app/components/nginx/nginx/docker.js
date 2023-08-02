import Events from "#lib/events";
import DockerEngine from "#lib/api/docker/engine";

const LABELS = {

    // http
    "nginx.http.server-name": "httpServerName",
    "nginx.http.client-max-body-size": "httpClientMaxBodySize",
    "nginx.http.cache.enabled": "httpCacheEnabled",
    "nginx.http.cache.max-size": "httpCacheMaxSize",
    "nginx.http.cache.inactive": "httpCacheInactive",
    "nginx.http.upstream-cache-status": "httpUpstreamCacheStatus",
    "nginx.http.proxy-cache-bypass": "httpProxyCacheBypass",

    // stream
    "nginx.stream.port": "streamPort",
};

export default class Docker extends Events {
    #dockerEngine = new DockerEngine();
    #started;
    #abortController;

    // public
    async start () {
        if ( this.#started ) return;

        this.#started = true;

        this.#start();
    }

    async stop () {
        if ( !this.#started ) return;

        this.#started = false;

        this.#abortController.abort();
        this.#abortController = null;
    }

    // private
    async #start () {
        if ( !this.#started ) return;

        this.#abortController = new AbortController();

        var res = await this.#dockerEngine.monitorSystemEvents( {
            "signal": this.#abortController.signal,
            "options": { "filters": { "scope": ["swarm"], "type": ["service"] } },
        } );

        if ( res.ok ) {
            const stream = res.data;

            res = await new Promise( resolve => {
                stream.on( "data", async data => {

                    // remove service
                    if ( data.Action === "remove" ) {
                        this.emit( "remove", { "id": data.Actor.ID } );
                    }

                    // create service
                    else if ( data.Action === "create" ) {
                        this.emit( "add", await this.#prepareService( data.Actor ) );
                    }

                    // update service
                    else if ( data.Action === "update" ) {
                        this.emit( "update", await this.#prepareService( data.Actor ) );
                    }
                } );

                stream.once( "error", e => resolve( result.catch( e, { "silent": true, "keepError": true } ) ) );

                stream.once( "close", () => resolve( result( 200 ) ) );
            } );
        }

        console.log( "Nginx docker listener terminated: ", res + "" );

        this.#start();
    }

    async #getServices () {
        const services = [];

        const res = await this.#dockerEngine.getServices();

        if ( !res.ok ) return res;

        for ( const service of res.data ) {
            services.push( await this.#prepareService( service ) );
        }

        return services;
    }

    async #prepareService ( service ) {
        if ( !service.Spec ) {
            const spec = await this.#dockerEngine.inspectService( service.ID );

            service = spec.data;
        }

        const data = {
            "id": service.ID,
            "name": service.Spec.Name,
            "hostname": "tasks." + service.Spec.Name,
            "options": {},
        };

        for ( const [label, value] of Object.entries( service.Spec.Labels ) ) {
            if ( label in LABELS ) data.options[LABELS[label]] = value;
        }

        if ( data.options.httpServerName ) data.options.httpServerName = data.options.httpServerName.split( /\s*,\s*|\s+/ );

        if ( data.options.streamPort ) data.options.streamPort = data.options.streamPort.split( /\s*,\s*|\s+/ );

        return data;
    }
}
