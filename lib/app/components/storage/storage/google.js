import Storage from "../storage.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";

export default class GoogleStorage extends Storage {
    #storage;

    constructor ( app, config ) {
        super( app, config );

        this.#storage = new GoogleCloudStorage( config.serviceAccount );
    }

    // protected
    async _init () {
        var res;

        res = await this.#storage.getBuckets();
        if ( !res.ok ) return res;

        const buckets = new Set( res.data.items?.map( item => item.name ) );

        for ( const bucket in this.config.buckets ) {

            // bucket already exists
            if ( buckets.has( this.config.buckets[bucket].bucket ) ) continue;

            // create bucket
            res = await this.#storage.createBucket( this.config.buckets[bucket].bucket, {
                "predefinedAcl": this.config.buckets[bucket].predefinedAcl,
                "predefinedDefaultObjectAcl": this.config.buckets[bucket].predefinedDefaultObjectAcl,
            } );
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
