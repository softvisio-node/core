import DockerEngine from "#lib/api/docker/engine";
import DockerService from "./docker/service.js";

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

    async stop () {
        if ( !this.#started ) return;

        this.#started = false;

        this.#abortController.abort();
        this.#abortController = null;

        // stop services
        for ( const service of Object.values( this.#services ) ) {
            delete this.#services[ service.id ];

            service.delete();
        }
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
            "options": { "filters": { "scope": [ "swarm" ], "type": [ "service" ] } },
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

                stream.once( "error", e => resolve( result.catch( e, { "log": false } ) ) );

                stream.once( "close", () => resolve( result( 200 ) ) );
            } );
        }

        console.log( "Nginx docker listener terminated: ", res + "" );

        this.#watchServices();
    }

    async #addService ( data ) {
        if ( !data.Spec ) {
            const res = await this.#dockerEngine.inspectService( data.ID );

            if ( !res.ok ) return;

            data = res.data;
        }

        var service = this.#services[ data.Spec.Name ];

        if ( service ) return service.update( data.Spec.Labels );

        service = new DockerService( this.#nginx, data.Spec.Name, data.Spec.Labels );

        this.#services[ service.id ] = service;
    }

    async #updateService ( data ) {
        const service = this.#services[ data.Attributes.name ];

        if ( !service ) return;

        const res = await this.#dockerEngine.inspectService( data.ID );

        if ( !res.ok ) return;

        service.update( res.data.Spec.Labels );
    }

    #deleteService ( data ) {
        const service = this.#services[ data.Attributes.name ];

        if ( !service ) return;

        delete this.#services[ service.id ];

        service.delete();
    }
}
