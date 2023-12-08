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

        this.#path = path.join( this.#storage.app.env.dataDir, this.#storage.config.location );
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
        return result( 200 );
    }

    async imageExists ( _path ) {
        return fs.promises
            .stat( this.#buildImagePath( _path ) )
            .then( stat => true )
            .catch( e => false );
    }

    async uploadImage ( _path, file ) {
        try {
            _path = this.#buildImagePath( _path );

            await fs.promises.mkdir( path.dirname( _path ), { "recursive": true } );

            await fs.promises.copyFile( file.path, _path );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    // XXX delete empty dirs
    async deleteImage ( _path ) {
        try {
            await fs.promises.rm( this.#buildImagePath( _path ), {
                "force": true,
            } );

            return result( 299 );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    async getFile ( file ) {
        try {
            const tmp = new TmpFile( {
                "name": path.basename( file.path ),
                "type": file.contentType,
            } );

            await fs.promises.copyFile( this.#buildImagePath( file.path ), tmp.path );

            return result( 200, tmp );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true, "silent": true } );
        }
    }

    async downloadFile ( req, _path, headers ) {
        const file = new File( {
            "path": this.#buildImagePath( _path ),
        } );

        req.end( {
            headers,
            "body": file,
        } );
    }

    // private
    #buildImagePath ( _path ) {
        return path.posix.join( this.#path, _path );
    }
}
