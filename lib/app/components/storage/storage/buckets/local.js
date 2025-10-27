import fs from "node:fs";
import path from "node:path";
import File from "#lib/file";
import { exists } from "#lib/fs";
import stream from "#lib/stream";
import StreamSlice from "#lib/stream/slice";
import Bucket from "../bucket.js";

export default class extends Bucket {
    #path;

    constructor ( buckets, location ) {
        super( buckets, location );

        this.#path = path.join( this.storage.app.env.dataDir, this.storage.config.location );
    }

    // public
    async init () {
        return result( 200 );
    }

    async imageExists ( image, { dbh } = {} ) {
        return exists( this.#buildImagePath( image.path ) );
    }

    async deleteImage ( image, { dbh } = {} ) {
        try {
            const imagePath = this.#buildImagePath( image.path );

            await fs.promises.rm( imagePath, {
                "force": true,
            } );

            // remove dir, if empty
            await fs.promises.rmdir( path.dirname( imagePath ) ).catch( e => {} );

            return result( 299 );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    // protected
    async _uploadImage ( image, file, { encrypt, dbh } = {} ) {
        const imagePath = this.#buildImagePath( image.path );

        try {
            await fs.promises.mkdir( path.dirname( imagePath ), {
                "recursive": true,
            } );

            const writeStream = fs.createWriteStream( imagePath );

            if ( encrypt ) {
                await stream.promises.pipeline( await this.app.crypto.encrypt( file.stream() ), writeStream );
            }
            else {
                await stream.promises.pipeline( file.stream(), writeStream );
            }

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _getBuffer ( file, { dbh } = {} ) {
        try {
            const buffer = await fs.promises.readFile( this.#buildImagePath( file.imagePath ) );

            return result( 200, buffer );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _getStream ( file, { start, length, dbh } = {} ) {
        file = new File( {
            "path": this.#buildImagePath( file.imagePath ),
        } );

        try {
            if ( file.isEncrypted ) {
                return result(
                    200,
                    stream.pipeline(

                        //
                        await this.app.crypto.decrypt( file.stream() ),
                        new StreamSlice( { start, length } ),
                        e => {}
                    )
                );
            }
            else {
                return result(
                    200,
                    file.stream( {
                        start,
                        "end": length == null
                            ? undefined
                            : ( start || 0 ) + length,
                    } )
                );
            }
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    #buildImagePath ( imagePath ) {
        return path.join( this.#path, imagePath );
    }
}
