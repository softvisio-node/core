import Storage from "../../storage.js";
import fs from "node:fs";
import path from "node:path";
import File from "#lib/file";
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

    async _uploadImage ( _path, file ) {
        try {
            _path = path.posix.join( this.#location, _path );

            await fs.promises.mkdir( path.dirname( _path ), { "recursive": true } );

            await fs.promises.copyFile( file.path, _path );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    // XXX delete empty dirs
    async _deleteImage ( _path ) {
        await fs.promises.rm( path.posix.join( this.#location, _path ), { "force": true } );

        return result( 299 );
    }

    async _getFile ( file ) {
        const tmp = new TmpFile( {
            "name": path.basename( file.path ),
            "type": file.contentType,
        } );

        await fs.promises.copyFile( path.posix.join( this.#location, file.oath ), tmp.path );

        return result( 200, tmp );
    }

    async _downloadFile ( req, _path, headers ) {
        const file = new File( {
            "path": path.posix.join( this.#location, _path ),
        } );

        req.end( {
            headers,
            "body": file,
        } );
    }
}
