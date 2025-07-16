import { normalizeName } from "./utils.js";

export default class MimeShebangs {
    #mime;
    #shebangs = new Map();

    constructor ( mime ) {
        this.#mime = mime;
    }

    // properties
    get size () {
        return this.#shebangs.size;
    }

    // public
    has ( shebang ) {
        return this.#shebangs.has( normalizeName( shebang ) );
    }

    add ( essence, shebangs ) {
        const mimeType = this.#mime.get( essence );

        if ( !mimeType ) throw new Error( "MIME type not registered" );

        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            if ( !mimeType.shebangs.has( shebang ) ) {
                mimeType.shebangs.add( shebang );
            }
            else {
                const currentMimeType = this.#shebangs.get( shebang );

                if ( currentMimeType && currentMimeType.essence !== mimeType.essence ) {
                    currentMimeType.shebangs.delete( shebang );
                }

                this.#shebangs.set( shebang, mimeType );
            }
        }

        return this;
    }

    delete ( shebangs ) {
        if ( !Array.isArray( shebangs ) ) shebangs = [ shebangs ];

        for ( let shebang of shebangs ) {
            shebang = normalizeName( shebang );

            const currentMimeType = this.#shebangs.get( shebang );

            if ( currentMimeType ) {
                this.#shebangs.delete( shebang );

                currentMimeType.shebangs.delete( shebang );
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
        const json = {};

        for ( const [ shebang, mimeType ] of this.#shebangs.entries() ) {
            json[ shebang ] = mimeType.essence;
        }

        return json;
    }

    [ Symbol.iterator ] () {
        return this.#shebangs.entries();
    }
}
