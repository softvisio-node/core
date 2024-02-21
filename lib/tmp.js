import fs from "node:fs";
import _path from "node:path";
import os from "node:os";
import uuid from "#lib/uuid";
import File from "#lib/file";
import _url from "node:url";
import { objectIsPlain } from "#lib/utils";

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
    class extends ( Super || class {} ) {
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
    constructor ( path ) {
        var tmpDir, name, extname, type;

        if ( objectIsPlain( path ) ) {
            ( { path, tmpDir, name, extname, type } = path );
        }

        if ( path ) {
            if ( path instanceof File ) {
                ( { path, name, type } = path );
            }
            else if ( typeof path === "string" ) {
                if ( path.startsWith( "file:" ) ) {
                    path = _url.fileURLToPath( path );
                }
            }
            else if ( path instanceof URL ) {
                path = _url.fileURLToPath( path );
            }
            else {
                throw `Path is not valid`;
            }
        }

        path ||= _path.join( tmpDir || os.tmpdir(), uuid() + ( extname || "" ) );

        super( path, {
            path,
            name,
            type,
        } );
    }
}

export class TmpDir extends Tmp() {
    constructor ( path ) {
        var tmpDir, name;

        if ( objectIsPlain( path ) ) {
            ( { path, tmpDir, name } = path );
        }

        if ( path ) {
            if ( typeof path === "string" ) {
                if ( path.startsWith( "file:" ) ) {
                    path = _url.fileURLToPath( path );
                }
            }
            else if ( path instanceof URL ) {
                path = _url.fileURLToPath( path );
            }
            else {
                throw `Path is not valid`;
            }
        }

        path ||= _path.join( tmpDir || os.tmpdir(), name || uuid() );

        super( path );

        fs.mkdirSync( this.path, { "recursive": true } );
    }
}
