import path from "node:path";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import stream from "#lib/stream";
import StreamSlice from "#lib/stream/slice";
import Bucket from "../bucket.js";

export default class extends Bucket {
    #name;
    #api;

    constructor ( buckets, location, { name, serviceAccount } = {} ) {
        super( buckets, location );

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

    async imageExists ( image, { dbh } = {} ) {
        const res = await this.#api.getFileMetadata( this.#buildImagePath( image.path ) );

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

    async deleteImage ( image, { dbh } = {} ) {
        const res = await this.#api.deleteFile( this.#buildImagePath( image.path ) );

        if ( res.status === 404 ) return result( 200 );

        return res;
    }

    // protected
    async _uploadImage ( image, file, { encrypt, dbh } = {} ) {
        var stream = file.stream();

        if ( encrypt ) {
            stream = await this.app.crypto.encrypt( stream );

            stream.setType( file.contentType );
        }

        return this.#api.uploadFile( this.#buildImagePath( image.path ), stream );
    }

    async _getBuffer ( file, { dbh } = {} ) {
        return this.#api.getBuffer( this.#buildImagePath( file.imagePath ) );
    }

    async _getStream ( file, { offset, length, dbh } = {} ) {
        if ( file.isEncrypted ) {
            const res = await this.#api.getStream( this.#buildImagePath( file.imagePath ) );
            if ( !res.ok ) return res;

            return result(
                200,
                stream.pipeline(

                    //
                    await this.app.crypto.decrypt( res.data ),
                    new StreamSlice( { offset, length } ),
                    e => {}
                )
            );
        }
        else {
            return this.#api.getStream( this.#buildImagePath( file.imagePath ), {
                offset,
                length,
            } );
        }
    }

    // XXX
    async _downloadFile ( req, file, headers, { dbh } = {} ) {
        if ( file.isEncrypted ) {
            const res = await this.getFile( file, { dbh } );

            if ( !res.ok ) return req.end( res );

            return req.end( {
                headers,
                "body": res.data,
            } );
        }
        else {
            return req.end( {
                "headers": headers,
                "body": async () => {
                    const reqHeaders = {};

                    const range = req.headers.get( "range" );
                    if ( range ) reqHeaders.range = range;

                    const res = await this.#api.getFileHttpResponse( this.#buildImagePath( file.imagePath ), {
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
    }

    // private
    #buildImagePath ( imagePath ) {
        return path.posix.join( this.#name, imagePath.slice( this.location.length ) );
    }
}
