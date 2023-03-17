import Storage from "../storage.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";

export default class GoogleStorage extends Storage {
    #storage;

    constructor ( app, config ) {
        super( app.config );

        this.#storage = new GoogleCloudStorage( config.serviceAccount );
    }
}
