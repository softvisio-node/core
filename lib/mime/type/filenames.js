import { createPattern } from "../utils.js";

export default class MimeTypeFilenames {
    #mimeType;
    #patterns = new Map();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#patterns.size;
    }

    // public
    has ( pattern ) {
        return this.#patterns.has( createPattern( pattern ).pattern );
    }

    add ( patterns ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            pattern = createPattern( pattern );

            if ( !this.#patterns.has( pattern.pattern ) ) {
                this.#patterns.set( pattern.pattern, pattern );

                this.#mimeType.mime?.filenames.add( this.#mimeType, pattern );
            }
        }

        return this;
    }

    delete ( patterns ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            pattern = createPattern( pattern );

            if ( this.#patterns.has( pattern.pattern ) ) {
                this.#patterns.delete( pattern.pattern );

                this.#mimeType.mime?.filenames.delete( pattern );
            }
        }

        return this;
    }

    clear () {
        for ( const pattern of this.#patterns.values() ) {
            this.delete( pattern );
        }

        return this;
    }

    toJSON () {
        return this.#patterns.size
            ? [ ...this.#patterns.keys() ].sort()
            : undefined;
    }

    test ( filename ) {
        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.test( filename ) ) return true;
        }

        return false;
    }

    [ Symbol.iterator ] () {
        return this.#patterns.keys();
    }
}
