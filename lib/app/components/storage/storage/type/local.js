import Storage from "../../storage.js";
import fs from "node:fs";
import path from "node:path";
import env from "#lib/env";
import File from "#lib/file";

export default class LocalStorage extends Storage {
    #location;

    constructor ( app, config ) {
        super( app, config );

        this.#location = path.join( env.root, "data/storage" );
    }

    // protected
    async _init () {
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );

        return result( 200 );
    }

    async _uploadImage ( id, file ) {
        const stream = fs.createWriteStream( path.join( this.#location, id ) );

        return new Promise( resolve => {
            stream.once( "close", () => resolve( result( 200 ) ) );

            file.stream().pipe( stream );
        } );
    }

    async _deleteImage ( id ) {
        await fs.promises.rm( path.join( this.#location, id ), { "force": true } );

        return result( 299 );
    }

    async _downloadFile ( req, file ) {
        file._file ??= new File( {
            "path": path.join( this.#location, file.imageId ),
            "type": file.contentType,
        } );

        req.end( {
            "headers": file.headers,
            "body": file._file,
        } );
    }
}
