import Api from "#lib/api";

export default class Services {
    #app;
    #config;
    #services = new Map();

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    async init () {
        for ( const [ name, options ] of Object.entries( this.#config ) ) {
            let Service;

            try {
                if ( options.type === "api" ) {
                    Service = Api;
                }
                else {
                    Service = ( await import( import.meta.resolve( options.type ) ) ).default;
                }

                const service = new Service( ...( options.constructor || [] ) );

                this.#services.set( name, service );
            }
            catch ( e ) {
                return result.catch( e );
            }
        }

        return result( 200 );
    }

    has ( name ) {
        return this.#services.has( name );
    }

    get ( name ) {
        return this.#services.get( name );
    }
}
