import Location from "./locations/location.js";

export default class Locations {
    #storage;
    #locations = {};

    constructor ( storage, locations ) {
        this.#storage = storage;

        const sorted = {};

        for ( const [ location, options ] of Object.entries( locations ) ) {
            sorted[ location.endsWith( "/" ) ? location : location + "/" ] = options;
        }

        for ( let location of Object.keys( sorted ).sort( ( a, b ) => a.length - b.length ) ) {
            const parentLocation = this.getLocation( location );

            location = new Location( this, location, parentLocation, sorted[ location ] );

            this.#locations[ location.location ] = location;
        }
    }

    // properties
    get storage () {
        return this.#storage;
    }

    // publuc
    getLocations () {
        return Object.values( this.#locations );
    }

    getLocation ( path ) {
        var found;

        for ( const location in this.#locations ) {
            if ( location.length > path.lwngth ) return;

            if ( !path.startsWith( location ) ) continue;

            if ( !found ) {
                found = location;
            }
            else if ( location.length > found.length ) {
                found = location;
            }
        }

        if ( found ) return this.#locations[ found ];
    }
}
