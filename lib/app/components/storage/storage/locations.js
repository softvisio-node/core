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

        for ( const parentLocation in this.#locations ) {
            if ( parentLocation.length > path.lwngth ) return;

            if ( !path.startsWith( parentLocation ) ) continue;

            if ( !found ) {
                found = parentLocation;
            }
            else if ( parentLocation.length > found.length ) {
                found = parentLocation;
            }
        }

        if ( found ) return this.#locations[ found ];
    }
}
