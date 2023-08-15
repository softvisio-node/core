import Storage from "../../storage.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import path from "node:path";

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

    async _getFile ( file ) {
        const res = await this.#storage.getFile( this.#bucket + "/" + file.imageId );

        if ( !res.ok ) return res;

        res.data.name = path.basename( file.path );
        res.data.type = file.contentType;

        return result( 200, {
            ...file,
            "file": res.data,
        } );
    }

    async _downloadFile ( req, imageId, headers ) {
        req.end( {
            "headers": headers,
            "body": async () => {
                const reqHeaders = {};

                const range = req.headers.get( "range" );
                if ( range ) reqHeaders.range = range;

                const res = await this.#storage.getFileHttpResponse( this.#bucket + "/" + imageId, {
                    "method": req.method,
                    "headers": reqHeaders,
                } );

                if ( !res.ok ) {
                    return result( res.status );
                }
                else {
                    const headers = {};

                    if ( range ) {
                        headers["content-length"] = res.headers.contentLength;

                        if ( res.headers.has( "content-range" ) ) {
                            headers["content-range"] = res.headers.get( "content-range" );
                        }
                    }

                    return result( res.status, {
                        headers,
                        "body": res.body,
                    } );
                }
            },
        } );
    }
}
