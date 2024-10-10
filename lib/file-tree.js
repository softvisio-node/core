import fs from "node:fs";
import _path from "node:path";
import File from "#lib/file";
import Counter from "#lib/threads/counter";

export default class FileTree {
    #files = new Map();

    // properties
    get size () {
        return this.#files.size;
    }

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

    [ Symbol.iterator ] () {
        return this.#files.values();
    }

    async write ( dirname ) {
        dirname = _path.resolve( dirname );

        const cache = new Set();

        const counter = new Counter();

        for ( const file of this.#files.values() ) {
            counter.value++;

            const fullPath = _path.join( dirname, file.path );

            const targetDirname = _path.dirname( fullPath );

            if ( !cache.has( targetDirname ) ) {
                await fs.promises.mkdir( targetDirname, {
                    "recursive": true,
                } );

                cache.add( targetDirname );
            }

            const stream = file.stream(),
                writeStream = fs.createWriteStream( fullPath );

            writeStream.once( "close", () => counter.value-- );

            stream.pipe( writeStream );
        }

        await counter.wait();
    }
}
