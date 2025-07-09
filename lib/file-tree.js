import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
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

    async write ( dirname ) {
        var error;

        dirname = path.resolve( dirname );

        const counter = new Counter();

        for ( const file of this.#files.values() ) {
            counter.value++;

            this.#writeFile( file, dirname )
                .catch( e => ( error = e ) )
                .finally( () => counter.value-- );
        }

        await counter.wait();

        if ( error ) throw error;
    }

    [ Symbol.iterator ] () {
        return this.#files.values();
    }

    // private
    async #writeFile ( file, dirname ) {
        const fullPath = path.join( dirname, file.path ),
            targetDirname = path.dirname( fullPath );

        await fs.promises.mkdir( targetDirname, {
            "recursive": true,
        } );

        return pipeline( file.stream(), fs.createWriteStream( fullPath ) );
    }
}
