import Events from "#lib/events";
import API from "#lib/api";

const DEFAULT_ENV_PREFIX = "APP_SERVICE_";

export default class ApiServices extends Events {
    #services = new Map();
    #ref = true;

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

        // ref
        if ( this.#ref ) api.ref();
        else api.unref();
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
            include = new Set( options.include ),
            exclude = new Set( options.exclude );

        const services = Object.entries( process.env ).reduce( ( services, entry ) => {
            if ( !entry[0].startsWith( prefix ) ) return services;

            const name = entry[0].substr( prefix.length );

            if ( include.size && !include.has( name ) ) return services;

            if ( exclude.size && exclude.has( name ) ) return services;

            services[name] = entry[1];

            return services;
        }, {} );

        this.addServices( services );
    }

    get ( name ) {
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
                service = this.get( service );

                if ( !service ) continue;

                service.publish( name, ...args );
            }
        }
    }

    async ping ( service ) {
        service = this.get( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.ping();
    }

    async healthcheck ( service ) {
        service = this.get( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.healthcheck();
    }

    async call ( service, method, ...args ) {
        service = this.get( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.call( method, ...args );
    }

    async callVoid ( service, method, ...args ) {
        service = this.get( service );

        if ( service ) service.callVoid( method, ...args );
    }

    async callCached ( service, method, cache, ...args ) {
        service = this.get( service );

        if ( !service ) return result( [404, `Service not found`] );

        return service.callCached( method, cache, ...args );
    }

    ref () {
        if ( this.#ref ) return;

        this.#ref = true;

        for ( const service of this.#services.values() ) service.ref();

        return this;
    }

    unref () {
        if ( !this.#ref ) return;

        this.#ref = false;

        for ( const service of this.#services.values() ) service.unref();

        return this;
    }
}
