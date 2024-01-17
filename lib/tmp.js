import fs from "node:fs";
import _path from "node:path";
import os from "node:os";
import uuid from "#lib/uuid";
import File from "#lib/file";
import _url from "node:url";
import { parseDataUrl } from "#lib/data-url";
import { objectIsPlain } from "#lb/utils";

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
    constructor ( options ) {
        var dirname, extname, path, name, type;

        if ( typeof options === "string" ) options = new URL( options );

        if ( options instanceof URL ) {
            if ( options.protocol === "file:" ) {
                path = _url.fileURLToPath( options );
            }
            else if ( options.protocol === "data:" ) {
                const dataUrl = parseDataUrl( options );

                type = dataUrl.type;
                name = dataUrl.params?.get( "name" );
                path = dataUrl.params?.get( "path" );
            }
            else {
                throw Error( `Only data: anf file: urls are supported` );
            }
        }
        else {
            ( { dirname, extname, path, name, type } = options || {} );
        }

        path ||= _path.join( dirname || os.tmpdir(), uuid() + ( extname || "" ) );

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
            if ( path instanceof URL ) {
                path = _url.fileURLToPath( path );
            }
            else if ( typeof path !== "string" ) {
                throw `Path is not valid`;
            }
        }

        path ||= _path.join( tmpDir || os.tmpdir(), name || uuid() );

        super( path );

        fs.mkdirSync( this.path, { "recursive": true } );
    }
}
