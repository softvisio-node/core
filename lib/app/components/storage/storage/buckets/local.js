import Bucket from "../bucket.js";
import fs from "node:fs";
import path from "node:path";
import File from "#lib/file";
import { pipeline } from "#lib/stream";

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
    async _uploadImage ( imagePath, file, { encrypt } = {} ) {
        imagePath = this.#buildImagePath( imagePath );

        return new Promise( resolve => {
            const end = e => {
                var res;

                if ( e ) {
                    res = result.catch( e, { "keepError": true, "silent": true } );
                }
                else {
                    res = result( 200 );
                }

                resolve( res );
            };

            fs.promises
                .mkdir( path.dirname( imagePath ), { "recursive": true } )
                .then( () => {
                    const writeStream = fs.createWriteStream( imagePath );

                    if ( encrypt ) {
                        pipeline( file.stream(), this.app.crypto.createCipher(), writeStream, end );
                    }
                    else {
                        pipeline( file.stream(), writeStream, end );
                    }
                } )
                .catch( end );
        } );
    }

    async _getFile ( file ) {
        const tmp = new this.storage.app.env.TmpFile( {
            "name": path.basename( file.path ),
            "type": file.contentType,
        } );

        const readStream = fs.createReadStream( this.#buildImagePath( file.imagePath ) ),
            writeStream = fs.createWriteStream( tmp.path );

        return new Promise( resolve => {
            const end = e => {
                var res;

                if ( e ) {
                    res = result.catch( e, { "keepError": true, "silent": true } );
                }
                else {
                    res = result( 200, tmp );
                }

                resolve( res );
            };

            if ( file.isEncrypted ) {
                pipeline( readStream, this.aap.crypto.createDecipher(), writeStream, end );
            }
            else {
                pipeline( readStream, writeStream, end );
            }
        } );
    }

    async _getBuffer ( file ) {
        try {
            var buffer = await fs.promises.readFile( this.#buildImagePath( file.imagePath ) );

            // decrypt buffer
            if ( file.isEncrypted ) {
                buffer = this.app.crypto.decrypt( buffer );
            }

            return result( 200, buffer );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    async _downloadFile ( req, file, headers ) {
        if ( file.isEncrypted ) {
            const res = await this.getFile( file );

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
        return path.posix.join( this.#path, imagePath );
    }
}
