import Events from "#lib/events";
import API from "#lib/api";

export default class APIHub extends Events {
    #services = {};

    constructor ( options = {} ) {
        super();

        for ( const name in options ) {
            this.addService( name, options[name] );
        }
    }

    // public
    addService ( name, url, options ) {
        this.#services[name] = new API( url, options );
    }

    getService ( name ) {
        return this.#services[name];
    }
}
