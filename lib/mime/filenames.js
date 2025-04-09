import { createPattern } from "./utils.js";

export default class MimeFilenames {
    #mime;
    #patterns = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#patterns.size;
    }

    // public
    has ( pattern ) {
        return this.#patterns.has( createPattern( pattern ).pattern );
    }

    get ( pattern ) {
        return this.#patterns.get( createPattern( pattern ).pattern )?.mimeType;
    }

    add ( essence, patterns ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( `MIME type not registered` );

        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            pattern = createPattern( pattern );

            if ( !mimeType.filenames.has( pattern ) ) {
                mimeType.filenames.add( pattern );
            }
            else {
                const currentMimeType = this.#patterns.get( pattern.pattern )?.mimeType;

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.filenames.delete( pattern );
                }

                this.#patterns.set( pattern.pattern, {
                    pattern,
                    mimeType,
                } );
            }
        }

        return this;
    }

    delete ( patterns ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            pattern = createPattern( pattern );

            const currentMimeType = this.#patterns.get( pattern.pattern )?.mimeType;

            if ( currentMimeType ) {
                this.#patterns.delete( pattern.pattern );

                currentMimeType.filenames.delete( pattern );
            }
        }

        return this;
    }

    clear () {
        for ( const { pattern } of this.#patterns.values() ) {
            this.delete( pattern );
        }

        return this;
    }

    findMimeType ( filename ) {
        for ( const { pattern, mimeType } of this.#patterns.values() ) {
            if ( pattern.test( filename ) ) return mimeType;
        }
    }

    toJSON () {
        const json = {};

        for ( const [ pattern, mimeType ] of this.#patterns.entries() ) {
            json[ pattern ] = mimeType.essence;
        }

        return json;
    }

    * [ Symbol.iterator ] () {
        for ( const { pattern, value } of this.#patterns.entries() ) {
            yield {
                pattern,
                "mimeType": value.mimeType,
            };
        }
    }
}
