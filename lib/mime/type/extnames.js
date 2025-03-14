import { normalizeExtname } from "../utils.js";

export default class MimeTypeExtnames {
    #mimeType;
    #extnames = new Set();
    #default;

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#extnames.size;
    }

    get default () {
        if ( this.#default === undefined ) {
            this.#default = this.#extnames.values().next().value || null;
        }

        return this.#default;
    }

    // public
    has ( extname ) {
        return this.#extnames.has( normalizeExtname( extname ) );
    }

    add ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( !this.#extnames.has( extname ) ) {
                this.#extnames.add( extname );

                this.#mimeType.mime?.extnames.add( this.#mimeType, extname );
            }
        }

        return this;
    }

    delete ( extnames ) {
        if ( !Array.isArray( extnames ) ) extnames = [ extnames ];

        for ( let extname of extnames ) {
            extname = normalizeExtname( extname );

            if ( this.#extnames.has( extname ) ) {
                this.#extnames.delete( extname );

                this.#mimeType.mime?.extnames.delete( extname );

                if ( this.#default === extname ) {
                    this.#default = undefined;
                }
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
        return this.#extnames.size
            ? [ ...this.#extnames ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#extnames.values();
    }
}
