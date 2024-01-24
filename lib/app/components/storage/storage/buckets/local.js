import Bucket from "../bucket.js";
import fs from "node:fs";
import path from "node:path";
import File from "#lib/file";
import { pipeline } from "node:stream";

export default class extends Bucket {
    #path;

    constructor ( storage, location, { deduplicate } = {} ) {
        super( storage, location, deduplicate );

        this.#path = path.join( this.storage.app.env.dataDir, this.storage.config.location );
    }

    // properties
    get path () {
        return this.#path;
    }

    // public
    async init () {
        return result( 200 );
    }

    async imageExists ( imagePath ) {
        return fs.promises
            .stat( this.#buildImagePath( imagePath ) )
            .then( stat => true )
            .catch( e => false );
    }

    async uploadImage ( imagePath, file, { encrypt } = {} ) {
        imagePath = this.#buildImagePath( imagePath );

        try {
            await fs.promises.mkdir( path.dirname( imagePath ), { "recursive": true } );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }

        return new Promise( resolve => {
            const writeStream = fs.createWriteStream( imagePath );

            writeStream.once( "error", e =>
                resolve( result.catch( e, {
                    "keepError": true,
                    "silent": true,
                } ) ) );

            writeStream.once( "close", () => resolve( result( 200 ) ) );

            if ( encrypt ) {
                pipeline( file.stream(), this.app.crypto.getCipher(), writeStream, () => {} );
            }
            else {
                pipeline( file.stream(), writeStream, () => {} );
            }
        } );
    }

    // XXX delete empty dirs
    async deleteImage ( imagePath ) {
        try {
            await fs.promises.rm( this.#buildImagePath( imagePath ), {
                "force": true,
            } );

            return result( 299 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    // protected
    // XXX decrypt
    async _getFile ( file ) {
        try {
            const tmp = new this.storage.app.env.TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            await fs.promises.copyFile( this.#buildImagePath( file.imagePath ), tmp.path );

            return result( 200, tmp );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    // XXX decrypt
    async _getBuffer ( file ) {
        try {
            return result( 200, await fs.promises.readFile( this.#buildImagePath( file.imagePath ) ) );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    // XXX decrypt
    async _downloadFile ( req, imagePath, headers ) {
        const file = new File( {
            "path": this.#buildImagePath( imagePath ),
        } );

        req.end( {
            headers,
            "body": file,
        } );
    }

    // private
    #buildImagePath ( imagePath ) {
        return path.posix.join( this.#path, imagePath );
    }
}
