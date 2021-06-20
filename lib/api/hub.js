import Events from "#lib/events";
import API from "#lib/api";

export default class APIHub extends Events {
    #services = {};

    constructor ( services ) {
        super();

        this.addServices( services );
    }

    // public
    addService ( name, url, options ) {
        this.#services[name] = new API( url, options );
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

    getService ( name ) {
        return this.#services[name];
    }

    // XXX
    publish ( name, services, ...args ) {}
}
