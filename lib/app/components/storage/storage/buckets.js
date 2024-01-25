import LocalBucket from "./buckets/local.js";
import GoogleBucket from "./buckets/google.js";

export default class Locations {
    #storage;
    #buckets = {};

    constructor ( storage ) {
        this.#storage = storage;
    }

    // properties
    get storage () {
        return this.#storage;
    }

    // publuc
    async init ( buckets ) {
        for ( let location of Object.keys( buckets ) ) {
            const options = buckets[ location ];

            if ( !location.endsWith( "/" ) ) location += "/";

            let bucket;

            if ( options.type === "local" ) {
                bucket = new LocalBucket( this, location, options );
            }
            else if ( options.type === "google" ) {
                bucket = new GoogleBucket( this, location, options );
            }
            else {
                return result( [ 400, `Bucket tyoe is unknown` ] );
            }

            const res = await bucket.init();
            if ( !res.ok ) return res;

            this.#buckets[ bucket.location ] = bucket;
        }

        return result( 200 );
    }

    get buckerts () {
        return Object.values( this.#buckets );
    }

    // XXX remove
    getBucket ( path ) {
        var found;

        for ( const parentLocation in this.#buckets ) {
            if ( parentLocation.length > path.lwngth ) return;

            if ( !path.startsWith( parentLocation ) ) continue;

            if ( !found ) {
                found = parentLocation;
            }
            else if ( parentLocation.length > found.length ) {
                found = parentLocation;
            }
        }

        if ( found ) return this.#buckets[ found ];
    }
}
