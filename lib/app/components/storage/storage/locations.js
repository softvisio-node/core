import Location from "./locations/location.js";

export default class Locations {
    #storage;
    #locations = {};

    constructor ( storage, locations ) {
        this.#storage = storage;

        for ( let location of Object.keys( locations ).sort( ( a, b ) => a.length - b.length ) ) {
            const parentLocation = this.#getPatentLocation( location );

            location = new Location( this, location, parentLocation, locations[ location ] );

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

    // XXX
    getLocation ( path ) {

        // for (const location of this.#sortedLocations) {
        //     if (path.startsWith(location + "/")) return this.#locations[location];
        // }
        // return this.#locations["/"];
    }

    // private
    #getPatentLocation ( location ) {
        if ( !location.endsWith( "/" ) ) location += "/";

        var found;

        for ( let parentLocation of Object.keys( this.#locations ) ) {
            if ( !parentLocation.endsWith( "/" ) ) parentLocation += "/";

            if ( !location.startsWith( parentLocation ) ) continue;

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
