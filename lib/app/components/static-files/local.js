import path from "node:path";
import fs from "node:fs";
import File from "#liv/file";

export default class {
    #staticFiles;
    #location;

    constructor ( staticFiles, location ) {
        this.#staticFiles = staticFiles;
        this.#location = path.resolve( location );

        if ( !fs.existsSync( this.#location ) ) fs.mkdirSync( this.#location, { "recursive": true } );
    }

    // public
    async add ( file, guid ) {
        const location = path.join( this.#location, guid );

        return fs.promises.copyFile( file.path, location );
    }

    async get ( guid ) {
        const location = path.join( this.#location, guid );

        return new File( {
            "path": location,
        } );
    }

    async clear ( guid ) {
        return fs.promises.rm( path.join( this.#location, guid ), { "force": true } );
    }
}
