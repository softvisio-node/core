import fs from "fs";
import _path from "path";
import File from "#lib/file";
import CondVar from "#lib/threads/condvar";

export default class FileTree {
    #files = new Map();

    // properties
    get isEmpty () {
        return !this.#files.size;
    }

    // public
    has ( path ) {
        return this.#files.has( path );
    }

    get ( path ) {
        return this.#files.get( path );
    }

    delete ( path ) {
        delete this.#files.delete( path );
    }

    add ( file ) {
        file = File.new( file );

        this.#files.set( file.path, file );

        return file;
    }

    files () {
        return this.#files.values();
    }

    async write ( dirname ) {
        const cv = new CondVar().begin();

        for ( const file of this.#files.values() ) {
            cv.begin();

            const fullPath = _path.resolve( dirname, file.path );

            fs.mkdirSync( _path.dirname( fullPath ), { "recursive": true } );

            const stream = file.stream(),
                writeStream = fs.createWriteStream( fullPath );

            writeStream.once( "close", () => cv.end() );

            stream.pipe( writeStream );
        }

        await cv.end().recv();
    }
}
