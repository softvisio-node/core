import { normalizeName } from "../utils.js";

export default class MimeTypeShebangs {
    #mimeType;
    #shebangs = new Set();

    constructor ( mimeType ) {
        this.#mimeType = mimeType;
    }

    // properties
    get size () {
        return this.#shebangs.size;
    }

    // public
    has ( shebang ) {
        return this.#shebangs.has( normalizeName( shebang ) );
    }

    add ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( !this.#shebangs.has( shebang ) ) {
                this.#shebangs.add( shebang );

                this.#mimeType.mime?.shebangs.add( this.#mimeType, shebang );
            }
        }

        return this;
    }

    delete ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( this.#shebangs.has( shebang ) ) {
                this.#shebangs.delete( shebang );

                this.#mimeType.mime?.shebangs.delete( shebang );
            }
        }

        return this;
    }

    clear () {
        for ( const item of this.#shebangs ) {
            this.delete( item );
        }

        return this;
    }

    toJSON () {
        return this.#shebangs.size
            ? [ ...this.#shebangs ].sort()
            : undefined;
    }

    [ Symbol.iterator ] () {
        return this.#shebangs.values();
    }
}
