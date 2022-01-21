import Api from "#lib/api";

const DEFAULT_ENV_PREFIX = "APP_SERVICE_";

export default class ApiServices {
    #services = new Map();
    #ref = true;

    constructor ( services ) {
        this.addServices( services );
    }

    // properties
    get num () {
        return this.#services.size;
    }

    // public
    addService ( name, url, options ) {
        const api = Api.new( url, options );

        this.#services.set( name, api );

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

            const name = entry[0].substring( prefix.length );

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
