import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "#lib/uuid";
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
    constructor ( options = {} ) {
        const dirname = options.dirname || os.tmpdir(),
            extname = options.extname || "";

        const _path = path.join( dirname, uuidv4() + extname );

        super( _path, {
            "path": _path,
            "name": options.name,
            "type": options.type,
            "size": options.size,
        } );
    }
}

export class TmpDir extends Tmp() {
    constructor ( options = {} ) {
        const dirname = options.dirname || os.tmpdir();

        const _path = path.join( dirname, uuidv4() );

        super( _path );

        fs.mkdirSync( this.path, { "recursive": true } );
    }
}
