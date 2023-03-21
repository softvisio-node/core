import Storage from "../../storage.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";

export default class GoogleStorage extends Storage {
    #storage;
    #bucket;

    constructor ( app, config ) {
        super( app, config );

        this.#storage = new GoogleCloudStorage( config.serviceAccount );
        this.#bucket = config.bucket;
    }

    // protected
    async _init () {
        var res;

        res = await this.#storage.getBucket( this.#bucket );

        if ( !res.ok ) {
            if ( res.status !== 404 ) return res;

            // create bucket
            res = await this.#storage.createBucket( this.#bucket );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async _uploadImage ( id, file ) {
        return this.#storage.uploadFile( this.#bucket + "/" + id, file );
    }

    async _deleteImage ( id ) {
        const res = await this.#storage.deleteFile( this.#bucket + "/" + id );

        if ( res.status === 404 ) return result( 200 );

        return res;
    }

    // XXX
    async _downloadFile ( req, name, file ) {
        const res = await this.#storage.getFileStream( this.#bucket + "/" + name );

        if ( !res.ok ) {
            return result( res.status );
        }
        else {
            return result( 200, res.body );
        }
    }
}
