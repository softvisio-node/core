import Events from "#lib/events";
import API from "#lib/api";

const DEFAULT_ENV_PREFIX = "APP_SERVICE_";

export default class APIHub extends Events {
    #services = new Map();

    constructor ( services ) {
        super();

        this.addServices( services );
    }

    // properties
    get num () {
        return this.#services.size;
    }

    // public
    addService ( name, url, options ) {
        const api = API.new( url, options );

        this.#services.set( name, api );

        // link events
        api.on( "connect", () => this.emit( "connect", name ) );
        api.on( "disconnect", () => this.emit( "disconnect", name ) );
        api.on( "event", ( eventName, args ) => this.emit( "event", name, eventName, args ) );
    }

    addServices ( services ) {
        if ( !services ) return;

        for ( const name in services ) {
            if ( Array.isArray( services[name] ) ) {
                this.addService( name, ...services[name] );
            }
            else {
                this.addService( name, services[name] );
            }
        }
    }

    addServicesFromEnv ( options = {} ) {
        const prefix = options.prefix || DEFAULT_ENV_PREFIX,
            names = options.names ? new Set( options.names ) : false;

        const services = Object.entries( process.env ).reduce( ( services, entry ) => {
            if ( entry[0].startsWith( prefix ) ) {
                const name = entry[0].substr( prefix.length );

                if ( names ) {
                    if ( names.has( name ) ) services[name] = entry[1];
                }
                else {
                    services[name] = entry[1];
                }
            }

            return services;
        }, {} );

        this.addServices( services );
    }

    getService ( name ) {
        return this.#services.get( name );
    }

    publish ( services, name, ...args ) {
        if ( !Array.isArray( services ) ) services = [services];

        for ( let service of services ) {

            // to all services
            if ( service === "*" ) {
                for ( const service in this.#services ) this.#services.get( service ).publish( name, ...args );

                break;
            }
            else {
                service = this.getService( service );

                if ( !service ) continue;

                service.publish( name, ...args );
            }
        }
    }

    async ping ( service ) {
        service = this.getService( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.ping();
    }

    async healthcheck ( service ) {
        service = this.getService( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.healthcheck();
    }

    async call ( service, method, ...args ) {
        service = this.getService( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.call( method, ...args );
    }

    async callVoid ( service, method, ...args ) {
        service = this.getService( service );

        if ( service ) service.callVoid( method, ...args );
    }
}
