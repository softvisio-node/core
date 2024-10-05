import GoogleBucket from "./buckets/google.js";
import LocalBucket from "./buckets/local.js";

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

    getBucket ( path ) {
        var found;

        for ( const location in this.#buckets ) {
            if ( location.length > path.lwngth ) return;

            if ( !path.startsWith( location ) ) continue;

            if ( !found ) {
                found = location;
            }
            else if ( location.length > found.length ) {
                found = location;
            }
        }

        if ( found ) return this.#buckets[ found ];
    }
}
