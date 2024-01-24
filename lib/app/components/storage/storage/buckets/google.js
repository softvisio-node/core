import Bucket from "../bucket.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import path from "node:path";

export default class extends Bucket {
    #name;
    #api;

    constructor ( storage, location, { deduplicate, name, serviceAccount } = {} ) {
        super( storage, location, deduplicate );

        this.#name = name;

        this.#api = new GoogleCloudStorage( serviceAccount );
    }

    // properties
    get name () {
        return this.#name;
    }

    // public
    async init () {
        var res;

        res = await this.#api.getBucket( this.#name );

        if ( !res.ok ) {
            if ( res.status !== 404 ) return res;

            // create bucket
            res = await this.#api.createBucket( this.#name );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async imageExists ( imagePath ) {
        imagePath = this.#buildImagePath( imagePath );

        const res = await this.#api.getFileMetadata( imagePath );

        if ( res.status === 606 ) {
            return false;
        }
        else if ( !res.ok ) {
            return null;
        }
        else {
            return true;
        }
    }

    async uploadImage ( imagePath, file ) {
        return this.#api.uploadFile( this.#buildImagePath( imagePath ), file );
    }

    async deleteImage ( imagePath ) {
        const res = await this.#api.deleteFile( this.#buildImagePath( imagePath ) );

        if ( res.status === 404 ) return result( 200 );

        return res;
    }

    async getFile ( file ) {
        const res = await this.#api.getFile( this.#buildImagePath( file.imagePath ) );

        if ( !res.ok ) return res;

        res.data.name = path.basename( file.path );

        res.data.type = file.contentType;

        return result( 200, res.data );
    }

    async getBuffer ( file ) {
        return this.#api.getBuffer( this.#buildImagePath( file.imagePath ) );
    }

    async downloadFile ( req, imagePath, headers ) {
        req.end( {
            "headers": headers,
            "body": async () => {
                const reqHeaders = {};

                const range = req.headers.get( "range" );
                if ( range ) reqHeaders.range = range;

                const res = await this.#api.getFileHttpResponse( this.#buildImagePath( imagePath ), {
                    "method": req.method,
                    "headers": reqHeaders,
                } );

                if ( !res.ok ) {
                    return result( res.status );
                }
                else {
                    const headers = {};

                    if ( range ) {
                        headers[ "content-length" ] = res.headers.contentLength;

                        if ( res.headers.has( "content-range" ) ) {
                            headers[ "content-range" ] = res.headers.get( "content-range" );
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

    // private
    #buildImagePath ( imagePath ) {
        return path.posix.join( this.#name, imagePath.substring( this.location.length ) );
    }
}
