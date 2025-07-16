import { normalizeExtname } from "./utils.js";

export default class MimeExtnames {
    #mime;
    #extnames = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#extnames.size;
    }

    // public
    has ( extname ) {
        return this.#extnames.has( normalizeExtname( extname ) );
    }

    get ( extname ) {
        return this.#extnames.get( normalizeExtname( extname ) );
    }

    add ( essence, extnames ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( "MIME type not registered" );

        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( !mimeType.extnames.has( extname ) ) {
                mimeType.extnames.add( extname );
            }
            else {
                const currentMimeType = this.#extnames.get( extname );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.extnames.delete( extname );
                }

                this.#extnames.set( extname, mimeType );
            }
        }

        return this;
    }

    delete ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            const currentMimeType = this.#extnames.get( extname );

            if ( currentMimeType ) {
                this.#extnames.delete( extname );

                currentMimeType.extnames.delete( extname );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#extnames ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        const json = {};

        for ( const [ extname, mimeType ] of this.#extnames.entries() ) {
            json[ extname ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#extnames.entries();
    }
}
