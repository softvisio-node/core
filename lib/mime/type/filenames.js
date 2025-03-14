import { normalizeName } from "../utils.js";

export default class MimeTypeFilenames {
    #mimeType;
    #filenames = new Set();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#filenames.size;
    }

    // public
    has ( filename ) {
        return this.#filenames.has( normalizeName( filename ) );
    }

    add ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( !this.#filenames.has( filename ) ) {
                this.#filenames.add( filename );

                this.#mimeType.mime?.filenames.add( this.#mimeType, filename );
            }
        }

        return this;
    }

    delete ( filenames ) {
        if ( !Array.isArray( filenames ) ) filenames = [ filenames ];

        for ( let filename of filenames ) {
            filename = normalizeName( filename );

            if ( this.#filenames.has( filename ) ) {
                this.#filenames.delete( filename );

                this.#mimeType.mime?.filenames.delete( filename );
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
        return this.#filenames.size
            ? [ ...this.#filenames ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#filenames.values();
    }
}
