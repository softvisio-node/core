import fs from "node:fs";
import path from "node:path";
import File from "#lib/file";
import { TmpFile } from "#lib/tmp";

export default class {
    #storage;
    #location;
    #deduplicate;
    #path;

    constructor ( storage, location, { deduplicate } = {} ) {
        this.#storage = storage;
        this.#location = location;
        this.#deduplicate = deduplicate;

        this.#path = path.join( this.app.env.dataDir, this.#storage.storage.config.localPath, this.#location );
    }

    // properties
    get location () {
        return this.#location;
    }

    get deduplicate () {
        return this.#deduplicate;
    }

    get path () {
        return this.#path;
    }

    // public
    async init () {
        if ( !fs.existsSync( this.#path ) ) fs.mkdirSync( this.#path, { "recursive": true } );

        return result( 200 );
    }

    async _imageExists ( _path ) {
        _path = path.posix.join( this.#path, _path );

        return fs.promises
            .stat( _path )
            .then( stat => true )
            .catch( e => false );
    }

    async _uploadImage ( _path, file ) {
        try {
            _path = path.posix.join( this.#path, _path );

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
        try {
            await fs.promises.rm( path.posix.join( this.#path, _path ), {
                "force": true,
            } );

            return result( 299 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    async _getFile ( file ) {
        try {
            const tmp = new TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            await fs.promises.copyFile( path.posix.join( this.#path, file.oath ), tmp.path );

            return result( 200, tmp );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    async _downloadFile ( req, _path, headers ) {
        const file = new File( {
            "path": path.posix.join( this.#path, _path ),
        } );

        req.end( {
            headers,
            "body": file,
        } );
    }
}
