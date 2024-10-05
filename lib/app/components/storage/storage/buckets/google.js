import fs from "node:fs";
import path from "node:path";
import Bucket from "../bucket.js";
import GoogleCloudStorage from "#lib/api/google/cloud/storage";
import { pipeline } from "#lib/stream";

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
            const tmpFile = new this.app.env.TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            const res = await new Promise( resolve => {
                pipeline( file.stream(), this.app.crypto.createCipher(), fs.createWriteStream( tmpFile.path ), e => {
                    if ( e ) {
                        resolve( result.catch( e ) );
                    }
                    else {
                        resolve( result( 200 ) );
                    }
                } );
            } );

            if ( !res.ok ) return res;

            file = tmpFile;
        }

        return this.#api.uploadFile( this.#buildImagePath( imagePath ), file );
    }

    async _getFile ( file ) {
        const res = await this.#api.getFileHttpResponse( this.#buildImagePath( file.imagePath ) );

        if ( !res.ok ) return result( res.status );

        return new Promise( resolve => {
            const tmpFile = new this.app.env.TmpFile( {
                    "name": path.basename( file.path ),
                    "type": file.contentType,
                } ),
                writeStream = fs.createwriteStream( tmpFile.path );

            const end = e => {
                var res;

                if ( e ) {
                    res = result.catch( e );
                }
                else {
                    res = result( 200, tmpFile );
                }

                resolve( res );
            };

            if ( file.isEncrypted ) {
                pipeline( res.body, this.app.crypto.createDecipher(), writeStream, end );
            }
            else {
                pipeline( res.body, writeStream, end );
            }
        } );
    }

    async _getBuffer ( file ) {
        const res = await this.#api.getBuffer( this.#buildImagePath( file.imagePath ) );

        if ( !res.ok ) return res;

        // decrypt buffer
        if ( file.isEncrypted ) {
            try {
                res.data = this.app.crypto.decrypt( res.data );
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
