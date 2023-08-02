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

export default class Docker {
    #nginx;
    #dockerEngine = new DockerEngine();
    #started;
    #abortController;
    #services = {};

    constructor ( nginx ) {
        this.#nginx = nginx;
    }

    // public
    async start () {
        if ( this.#started ) return;

        this.#started = true;

        await this.#initServices();

        this.#watchServices();
    }

    // XXX delete services
    async stop () {
        if ( !this.#started ) return;

        this.#started = false;

        this.#abortController.abort();
        this.#abortController = null;
    }

    // private
    async #initServices () {
        const res = await this.#dockerEngine.getServices();

        if ( !res.ok ) return res;

        for ( const service of res.data ) {
            await this.#addService( service );
        }

        return result( 200 );
    }

    async #watchServices () {
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

                    // create service
                    if ( data.Action === "create" ) {
                        this.#addService( data.Actor );
                    }

                    // update service
                    else if ( data.Action === "update" ) {
                        this.#updateService( data.Actor );
                    }

                    // remove service
                    else if ( data.Action === "remove" ) {
                        this.#deleteService( data.Actor );
                    }
                } );

                stream.once( "error", e => resolve( result.catch( e, { "silent": true, "keepError": true } ) ) );

                stream.once( "close", () => resolve( result( 200 ) ) );
            } );
        }

        console.log( "Nginx docker listener terminated: ", res + "" );

        this.#watchServices();
    }

    async #addService1 ( service ) {
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

    #addService ( data ) {
        console.log( "--- AGG", data );
    }

    #updateService ( data ) {
        console.log( "--- UPDATE", data );
    }

    #deleteService ( data ) {
        console.log( "--- DELETE", data );
    }
}
