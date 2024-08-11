import Api from "#lib/api";

export default class Services {
    #services = new Map();
    #ref = true;

    constructor ( services ) {
        this.addServices( services );
    }

    // properties
    get hasRef () {
        return this.#ref;
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

    has ( name ) {
        return this.#services.has( name );
    }

    get ( name ) {
        return this.#services.get( name );
    }

    ref () {
        if ( this.#ref ) return this;

        this.#ref = true;

        for ( const service of this.#services.values() ) {
            service.ref();
        }

        return this;
    }

    unref () {
        if ( !this.#ref ) return this;

        this.#ref = false;

        for ( const service of this.#services.values() ) {
            service.unref();
        }

        return this;
    }
}
