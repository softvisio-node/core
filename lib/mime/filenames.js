import { normalizeName } from "./utils.js";

export default class MimeFilenames {
    #mime;
    #filenames = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#filenames.size;
    }

    // public
    has ( filename ) {
        return this.#filenames.has( normalizeName( filename ) );
    }

    get ( filename ) {
        return this.#filenames.get( normalizeName( filename ) );
    }

    add ( essence, filenames ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( `MIME type not registered` );

        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( !mimeType.filenames.has( filename ) ) {
                mimeType.filenames.add( filename );
            }
            else {
                const currentMimeType = this.#filenames.get( filename );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.filenames.delete( filename );
                }

                this.#filenames.set( filename, mimeType );
            }
        }

        return this;
    }

    delete ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            const currentMimeType = this.#filenames.get( filename );

            if ( currentMimeType ) {
                this.#filenames.delete( filename );

                currentMimeType.filenames.delete( filename );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#filenames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        const json = {};

        for ( const [ filename, mimeType ] of this.#filenames.entries() ) {
            json[ filename ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#filenames.entries();
    }
}
