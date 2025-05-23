import fs from "node:fs";
import os from "node:os";
import _path from "node:path";
import url from "node:url";
import File from "#lib/file";
import { objectIsPlain } from "#lib/utils";
import uuid from "#lib/uuid";

const tmpItems = new Set(),
    finalizationRegistry = new FinalizationRegistry( tmpItem => tmpItem.destroy() );

var defaultTmpDir = os.tmpdir();

process.setMaxListeners( process.getMaxListeners() + 1 );

process.on( "exit", () => {
    for ( const tmpItem of tmpItems ) {
        tmpItem.destroySync();
    }
} );

class TmpItem {
    #path;
    #destroyed = false;

    constructor ( tmp, path ) {
        this.#path = path;

        tmpItems.add( this );

        finalizationRegistry.register( tmp, this, this );
    }

    // properties
    get path () {
        return this.#path;
    }

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    destroySync () {
        if ( this.#destroyed ) return;

        fs.rmSync( this.#path, {
            "recursive": true,
            "force": true,
        } );

        this.#destroyed = true;

        tmpItems.delete( this );

        finalizationRegistry.unregister( this );
    }

    async destroy () {
        if ( this.#destroyed ) return;

        await fs.promises.rm( this.#path, {
            "recursive": true,
            "force": true,
        } );

        this.#destroyed = true;

        tmpItems.delete( this );

        finalizationRegistry.unregister( this );
    }
}

const Tmp = Super =>
    class extends ( Super || class {} ) {
        #tmpItem;

        constructor ( path, options ) {
            super( options );

            this.#tmpItem = new TmpItem( this, path );
        }

        // static
        static get defaultTmpDir () {
            return defaultTmpDir;
        }

        static set defaultTmpDir ( tmpDir ) {
            if ( tmpDir ) {
                defaultTmpDir = tmpDir;
            }
        }

        // properties
        get path () {
            return this.#tmpItem.path;
        }

        get isDestroyed () {
            return this.#tmpItem.isDestroyed;
        }

        // public
        toString () {
            return this.path;
        }

        destroy () {
            this.#tmpItem.destroySync();
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
                    path = url.fileURLToPath( path );
                }
            }
            else if ( path instanceof URL ) {
                path = url.fileURLToPath( path );
            }
            else {
                throw `Path is not valid`;
            }
        }

        path ||= _path.join( tmpDir || defaultTmpDir, uuid() + ( extname || "" ) );

        super( path, {
            path,
            name,
            type,
        } );
    }
}

export class TmpDir extends Tmp() {
    constructor ( path ) {
        var tmpDir;

        if ( objectIsPlain( path ) ) {
            ( { path, tmpDir } = path );
        }

        if ( path ) {
            if ( typeof path === "string" ) {
                if ( path.startsWith( "file:" ) ) {
                    path = url.fileURLToPath( path );
                }
            }
            else if ( path instanceof URL ) {
                path = url.fileURLToPath( path );
            }
            else {
                throw `Path is not valid`;
            }
        }

        path ||= _path.join( tmpDir || defaultTmpDir, uuid() );

        super( path );

        fs.mkdirSync( this.path, {
            "recursive": true,
        } );
    }
}
