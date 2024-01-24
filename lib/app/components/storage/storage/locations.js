import Location from "./locations/location.js";

export default class Locations {
    #storage;
    #locations = {};

    constructor ( storage, locations ) {
        this.#storage = storage;

        for ( let location of Object.keys( locations ).sort( ( a, b ) => b.length - a.length ) ) {
            const parentLocation = this.#getPatentLocation( location );

            location = new Location( location, parentLocation, locations[ location ] );

            this.#locations[ location.location ] = location;
        }
    }

    // publuc
    // XXX
    getLocation ( path ) {

        // for (const location of this.#sortedLocations) {
        //     if (path.startsWith(location + "/")) return this.#locations[location];
        // }
        // return this.#locations["/"];
    }

    // private
    #getPatentLocation ( location ) {}
}
