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
            let service;

            try {
                if ( typeof options === "string" ) {
                    service = new Api( options );
                }
                else if ( options.import ) {
                    const { "default": Service } = await import( import.meta.resolve( options.import ) );

                    if ( options.arguments ) {
                        service = new Service( ...options.arguments );
                    }
                    else {
                        service = new Service( ...options.options );
                    }
                }
                else {
                    service = new Api( options.url, options.options );
                }
            }
            catch ( e ) {
                return result.catch( e );
            }

            this.#services.set( name, service );
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
