import Storage from "../../storage.js";
import fs from "node:fs";
import path from "node:path";
import { TmpFile } from "#lib/tmp";

export default class LocalStorage extends Storage {
    #location;

    constructor ( app, config ) {
        super( app, config );

        this.#location = path.join( this.app.env.dataDir, "storage" );
    }

    // protected
    async _init () {
        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );

        return result( 200 );
    }

    async _uploadImage ( id, file ) {
        await fs.promises.copyFile( file.path, path.join( this.#location, id ) );

        return result( 200 );
    }

    async _deleteImage ( id ) {
        await fs.promises.rm( path.join( this.#location, id ), { "force": true } );

        return result( 299 );
    }

    async _getFile ( file, stream ) {
        if ( stream ) {
            return result( 200, {
                ...file,
                "stream": fs.createReadStream( path.join( this.#location, file.imageId ) ),
            } );
        }
        else {
            const tmp = new TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            await fs.promises.copy( path.join( this.#location, file.imageId ), tmp.path );

            return result( 200, {
                ...file,
                "file": tmp,
            } );
        }
    }
}
