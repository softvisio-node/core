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
        const sorted = {};

        for ( const [ location, options ] of Object.entries( buckets ) ) {
            sorted[ location.endsWith( "/" ) ? location : location + "/" ] = options;
        }

        for ( const location of Object.keys( sorted ).sort( ( a, b ) => a.length - b.length ) ) {
            const options = sorted[ location ];

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
    }

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
