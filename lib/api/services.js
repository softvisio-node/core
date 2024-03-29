import Api from "#lib/api";

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
            if ( Array.isArray( services[ name ] ) ) {
                this.addService( name, ...services[ name ] );
            }
            else {
                this.addService( name, services[ name ] );
            }
        }
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
