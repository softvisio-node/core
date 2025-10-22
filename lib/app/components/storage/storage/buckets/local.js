import "#lib/stream";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { exists } from "#lib/fs";
import { TmpFile } from "#lib/tmp";
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

    async imageExists ( imagePath, { dbh } = {} ) {
        return exists( this.#buildImagePath( imagePath ) );
    }

    // XXX delete empty dirs
    async deleteImage ( imagePath, { dbh } = {} ) {
        try {
            await fs.promises.rm( this.#buildImagePath( imagePath ), {
                "force": true,
            } );

            return result( 299 );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    // protected
    async _uploadImage ( imagePath, file, { encrypt, dbh } = {} ) {
        imagePath = this.#buildImagePath( imagePath );

        try {
            await fs.promises.mkdir( path.dirname( imagePath ), {
                "recursive": true,
            } );

            const writeStream = fs.createWriteStream( imagePath );

            if ( encrypt ) {
                await pipeline( await this.app.crypto.encrypt( file.stream() ), writeStream );
            }
            else {
                await pipeline( file.stream(), writeStream );
            }

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _getFile ( file, { dbh } = {} ) {
        const tmp = new TmpFile( {
            "name": path.basename( file.path ),
            "type": file.contentType,
        } );

        const readStream = fs.createReadStream( this.#buildImagePath( file.imagePath ) ),
            writeStream = fs.createWriteStream( tmp.path );

        try {
            if ( file.isEncrypted ) {
                await pipeline( await this.app.crypto.decrypt( readStream ), writeStream );
            }
            else {
                await pipeline( readStream, writeStream );
            }

            return result( 200, tmp );
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

    async _getStream ( file, { dbh } = {} ) {
        var stream;

        try {
            stream = fs.createReadStream( this.#buildImagePath( file.imagePath ) );

            return result( 200, stream );
        }
        catch ( e ) {
            stream?.destroy();

            return result.catch( e );
        }
    }

    // private
    #buildImagePath ( imagePath ) {
        return path.join( this.#path, imagePath );
    }
}
