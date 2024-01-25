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

    getBucket ( path ) {
        var found;

        for ( const bucket of this.getBuckets() ) {
            if ( bucket.location.length > path.lwngth ) return;

            if ( !path.startsWith( bucket.location ) ) continue;

            if ( !found ) {
                found = bucket;
            }
            else if ( bucket.location.length > found.location.length ) {
                found = bucket;
            }
        }

        return found;
    }
}
