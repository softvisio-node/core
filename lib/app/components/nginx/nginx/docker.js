import DockerEngine from "#lib/api/docker/engine";
import ActivityController from "#lib/threads/activity-controller";
import DockerService from "./docker/service.js";

export default class Docker {
    #nginx;
    #dockerEngine = new DockerEngine();
    #services = {};
    #activityController;

    constructor ( nginx ) {
        this.#nginx = nginx;

        this.#activityController = new ActivityController( {
            "doStart": this.#doStart.bind( this ),
            "doStop": this.#doStop.bind( this ),
        } );
    }

    // public
    async start () {
        return this.#activityController.start();
    }

    async stop () {
        return this.#activityController.stop();
    }

    // private
    async #doStart () {
        var res;

        res = await this.#initServices();
        if ( !res.ok ) return res;

        this.#watchServices();

        return result( 200 );
    }

    async #doStop () {

        // stop services
        for ( const service of Object.values( this.#services ) ) {
            delete this.#services[ service.id ];

            service.delete();
        }

        return result( 200 );
    }

    async #initServices () {
        const res = await this.#dockerEngine.getServices();
        if ( !res.ok ) return res;

        for ( const service of res.data ) {
            await this.#addService( service );
        }

        return result( 200 );
    }

    async #watchServices () {
        var res;

        while ( true ) {
            const signal = this.#activityController.abortSignal;

            res = await this.#dockerEngine.monitorSystemEvents( {
                signal,
                "options": { "filters": { "scope": [ "swarm" ], "type": [ "service" ] } },
            } );

            if ( res.ok ) {
                console.log( "Nginx docker listener started" );

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

            // aborted
            if ( signal.aborted ) break;
        }
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
