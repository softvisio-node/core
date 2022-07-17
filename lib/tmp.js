import fs from "node:fs";
import _path from "node:path";
import os from "node:os";
import uuidV4 from "#lib/uuid";
import File from "#lib/file";

const REGISTRY = new Set();

const FINALIZATION = new FinalizationRegistry( reg => reg.destroy() );

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const reg of REGISTRY ) reg.destroy();
} );

class Reg {
    #path;
    #destroyed = false;

    constructor ( tmp, path ) {
        this.#path = path;

        REGISTRY.add( this );

        FINALIZATION.register( tmp, this, this );
    }

    // properties
    get path () {
        return this.#path;
    }

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    destroy () {
        if ( this.#destroyed ) return;

        fs.rmSync( this.#path, { "recursive": true, "force": true } );

        this.#destroyed = true;

        REGISTRY.delete( this );

        FINALIZATION.unregister( this );
    }
}

const Tmp = Super =>
    class extends ( Super || Object ) {
        #reg;

        constructor ( path, options ) {
            super( options );

            this.#reg = new Reg( this, path );
        }

        // properties
        get path () {
            return this.#reg.path;
        }

        get isDestroyed () {
            return this.#reg.isDestroyed;
        }

        // public
        toString () {
            return this.path;
        }

        destroy () {
            this.#reg.destroy();
        }
    };

export class TmpFile extends Tmp( File ) {
    constructor ( { dirname, extname, path, name, type } = {} ) {
        path ||= _path.join( dirname || os.tmpdir(), uuidV4() + extname ?? "" );

        super( path, {
            path,
            name,
            type,
        } );
    }
}

export class TmpDir extends Tmp() {
    constructor ( { dirname, path } = {} ) {
        dirname ||= os.tmpdir();

        path = _path.join( dirname, uuidV4() );

        super( path );

        fs.mkdirSync( this.path, { "recursive": true } );
    }
}
