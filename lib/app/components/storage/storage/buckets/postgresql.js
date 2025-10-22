import "#lib/stream";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import File from "#lib/file";
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

    // XXX
    async imageExists ( imagePath, { dbh } = {} ) {
        dbh ||= this.dbh;

        return true;
    }

    // XXX
    async deleteImage ( imagePath, { dbh } = {} ) {
        dbh ||= this.dbh;

        return result( 200 );
    }

    // protected
    // XXX
    async _uploadImage ( imagePath, file, { encrypt, dbh } = {} ) {
        dbh ||= this.dbh;

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

    // XXX
    async _getFile ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

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

    // XXX
    async _getBuffer ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        try {
            var buffer = await fs.promises.readFile( this.#buildImagePath( file.imagePath ) );

            // decrypt buffer
            if ( file.isEncrypted ) {
                buffer = await this.app.crypto.decrypt( buffer );
            }

            return result( 200, buffer );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    // XXX
    async _downloadFile ( req, file, headers, { dbh } = {} ) {
        dbh ||= this.dbh;

        if ( file.isEncrypted ) {
            const res = await this.getFile( file, { dbh } );

            if ( !res.ok ) return req.end( res );

            file = res.data;
        }
        else {
            file = new File( {
                "path": this.#buildImagePath( file.imagePath ),
            } );
        }

        return req.end( {
            headers,
            "body": file,
        } );
    }

    // private
    #buildImagePath ( imagePath ) {
        return path.join( this.#path, imagePath );
    }
}
