import path from "node:path";
import fs from "node:fs";
import File from "#lib/file";

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

        await fs.promises.copyFile( file.path, location );

        return result( 200 );
    }

    async get ( guid ) {
        const location = path.join( this.#location, guid ),
            file = new File( {
                "path": location,
            } );

        return result( 200, file );
    }

    async clear ( guid ) {
        return fs.promises.rm( path.join( this.#location, guid ), { "force": true } );
    }
}
