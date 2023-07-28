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
    #docker = new DockerEngine();
    #isStarted;

    // public
    async getServices () {
        const services = [];

        for ( const service of ( await this.#docker.getServices() ).data ) {
            services.push( await this.#prepareService( service ) );
        }

        return services;
    }

    async watch () {
        if ( this.#isStarted ) return;

        this.#isStarted = true;

        const stream = await this.#docker.monitorSystemEvents( { "filters": { "scope": ["swarm"], "type": ["service"] } } );

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
    }

    // private
    async #prepareService ( service ) {
        if ( !service.Spec ) {
            const spec = await this.#docker.inspectService( service.ID );

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
