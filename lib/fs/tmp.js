import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

const REGISTRY = new Set();

const FINALIZATION = new FinalizationRegistry( reg => reg.remove() );

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const reg of REGISTRY ) reg.remove();
} );

class Reg {
    #path;
    #removed;

    static new ( path ) {
        const reg = new this( path );

        REGISTRY.add( reg );

        const tmp = new String( reg.path );

        FINALIZATION.register( tmp, reg, reg );

        tmp.remove = function () {
            if ( reg.removed ) return;

            reg.remove();

            this.removed = true;
        };

        return tmp;
    }

    constructor ( path ) {
        this.#path = path;
    }

    get path () {
        return this.#path;
    }

    get removed () {
        return this.#removed;
    }

    remove () {
        if ( this.#removed ) return;

        fs.rmSync( this.#path, { "recursive": true, "force": true } );

        this.#removed = true;

        REGISTRY.delete( this );
        FINALIZATION.unregister( this );
    }
}

export function file ( options = {} ) {
    const prefix = options.prefix || os.tmpdir(),
        ext = options.ext || "";

    return Reg.new( path.join( prefix, uuidv4() + ext ) );
}

export function dir ( options = {} ) {
    const prefix = options.prefix || os.tmpdir();

    const tmp = Reg.new( path.join( prefix, uuidv4() ) );

    fs.mkdirSync( tmp.toString(), { "recursive": true } );

    return tmp;
}
