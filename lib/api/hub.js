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
        this.#services.set( name, new API( url, options ) );
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

    addServicesFromEnv ( prefix ) {
        prefix ||= DEFAULT_ENV_PREFIX;

        const services = Object.entries( process.env ).reduce( ( services, entry ) => {
            if ( entry[0].startsWith( prefix ) ) services[entry[0].substr( prefix.length )] = entry[1];

            return services;
        }, {} );

        this.addServices( services );
    }

    getService ( name ) {
        return this.#services.get( name );
    }

    // XXX
    publish ( name, services, ...args ) {}
}
