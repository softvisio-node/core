import "#lib/stream";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import { TmpFile } from "#lib/tmp";
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

    async deleteImage ( imagePath ) {
        const res = await this.#api.deleteFile( this.#buildImagePath( imagePath ) );

        if ( res.status === 404 ) return result( 200 );

        return res;
    }

    // protected
    async _uploadImage ( imagePath, file, { encrypt } = {} ) {
        if ( encrypt ) {

            // encrypt to tmp file
            const tmpFile = new TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            try {
                await pipeline( await this.app.crypto.encrypt( file.stream() ), fs.createWriteStream( tmpFile.path ) );

                file = tmpFile;
            }
            catch ( e ) {
                return result.catch( e, { "log": false } );
            }
        }

        return this.#api.uploadFile( this.#buildImagePath( imagePath ), file );
    }

    async _getFile ( file ) {
        const res = await this.#api.getFileHttpResponse( this.#buildImagePath( file.imagePath ) );
        if ( !res.ok ) return result( res.status );

        try {
            const tmpFile = new TmpFile( {
                    "name": path.basename( file.path ),
                    "type": file.contentType,
                } ),
                writeStream = fs.createwriteStream( tmpFile.path );

            if ( file.isEncrypted ) {
                await pipeline( await this.app.crypto.decrypt( res.body ), writeStream );
            }
            else {
                await pipeline( res.body, writeStream );
            }

            return result( 200, tmpFile );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _getBuffer ( file ) {
        const res = await this.#api.getBuffer( this.#buildImagePath( file.imagePath ) );

        if ( !res.ok ) return res;

        // decrypt buffer
        if ( file.isEncrypted ) {
            try {
                res.data = await this.app.crypto.decrypt( res.data );
            }
            catch ( e ) {
                return result.catch( e );
            }
        }

        return res;
    }

    async _downloadFile ( req, file, headers ) {
        if ( file.isEncrypted ) {
            const res = await this.getFile( file );

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
