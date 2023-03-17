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

        res = await this.#storage.getBucket( this.config.bucket );

        if ( !res.ok ) {
            if ( res.status !== 404 ) return res;

            // create bucket
            res = await this.#storage.createBucket( this.config.bucket );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }
}
