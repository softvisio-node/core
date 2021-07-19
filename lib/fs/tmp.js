import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

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

class Tmp {
    #reg;

    constructor ( path ) {
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
}

export class TmpFile extends Tmp {
    constructor ( options = {} ) {
        const prefix = options.prefix || os.tmpdir(),
            ext = options.ext || "";

        super( path.join( prefix, uuidv4() + ext ) );
    }
}

export class TmpDir extends Tmp {
    constructor ( options = {} ) {
        const prefix = options.prefix || os.tmpdir();

        super( path.join( prefix, uuidv4() ) );

        fs.mkdirSync( this.path, { "recursive": true } );
    }
}
