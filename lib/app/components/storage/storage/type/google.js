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
    async _downloadFile ( req, file ) {
        const headers = {};

        const range = req.headers.get( "range" );
        if ( range ) headers.range = range;

        const res = await this.#storage.getFileHttpResponse( this.#bucket + "/" + file.imageId, { headers } );

        if ( !res.ok ) {
            req.end( res.status );
        }
        else {
            let headers;

            if ( range ) {
                headers = {
                    ...file.headers,
                    "content-length": req.headers.contentLength,
                };

                if ( res.headers.get( "content-range" ) ) headers["content-range"] = res.headers.get( "content-range" );
            }
            else {
                headers = file.headers;
            }

            req.end( {
                "status": 200,
                headers,
                "body": res.body,
            } );
        }
    }
}
