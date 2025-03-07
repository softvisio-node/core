import fs from "node:fs";
import * as bits from "#lib/bits";

const MODE_GROUPS = [ "u", "g", "o" ],
    PERMISSION_INDEX = {
        "ur": 0,
        "uw": 1,
        "ux": 2,
        "gr": 3,
        "gw": 4,
        "gx": 5,
        "or": 6,
        "ow": 7,
        "ox": 8,
    };

// public
export function calculateMode ( mode, baseMode ) {
    if ( typeof mode === "number" ) return mode;

    if ( baseMode == null ) {
        baseMode = 0;
    }
    else if ( typeof baseMode === "string" ) {
        baseMode = calculateMode( baseMode );
    }

    if ( !isFullMode( mode ) ) {
        const fullMode = [ "?", "?", "?", "?", "?", "?", "?", "?", "?" ];

        for ( const group of mode.split( " " ) ) {

            // +rwx
            if ( /^[+-][rwx]{1,3}$/.test( group ) ) {
                for ( let n = 1; n < group.length; n++ ) {
                    for ( const modeGroup of MODE_GROUPS ) {
                        const idx = PERMISSION_INDEX[ modeGroup + group[ n ] ];

                        fullMode[ idx ] = group[ 0 ] === "-"
                            ? "-"
                            : group[ n ];
                    }
                }
            }

            // u+rwx
            else if ( /^[gou][+-][rwx]{1,3}$/.test( group ) ) {
                for ( let n = 2; n < group.length; n++ ) {
                    const idx = PERMISSION_INDEX[ group[ 0 ] + group[ n ] ];

                    fullMode[ idx ] = group[ 1 ] === "-"
                        ? "-"
                        : group[ n ];
                }
            }
            else {
                throw new Error( `File mode "${ mode }" is not valid` );
            }
        }

        mode = fullMode.join( "" );
    }

    for ( let n = 0; n <= 8; n++ ) {

        // drop permission
        if ( mode[ n ] === "-" ) {
            baseMode = bits.dropBits( baseMode, 2 ** ( 8 - n ) );
        }

        // set permission
        else if ( mode[ n ] !== "?" ) {
            baseMode = bits.setBits( baseMode, 2 ** ( 8 - n ) );
        }
    }

    return baseMode;
}

export async function chmod ( path, mode ) {
    if ( typeof mode === "string" ) {
        if ( isBaseModeRequired( mode ) ) {
            var { "mode": baseMode } = await fs.promises.stat( path );

            baseMode = baseMode & 0o777;
        }

        mode = calculateMode( mode, baseMode );
    }

    return fs.promises.chmod( path, mode );
}

export function chmodSync ( path, mode ) {
    if ( typeof mode === "string" ) {
        if ( isBaseModeRequired( mode ) ) {
            var { "mode": baseMode } = fs.statSync( path );

            baseMode = baseMode & 0o777;
        }

        mode = calculateMode( mode, baseMode );
    }

    return fs.chmodSync( path, mode );
}

export async function exists ( path ) {
    return fs.promises
        .access( path )
        .then( () => true )
        .catch( e => {

            // file not found
            if ( e.code === "ENOENT" ) return false;

            throw e;
        } );
}

export async function sliceFile ( filePath, start, end ) {
    const size = ( await fs.promises.stat( filePath ) ).size;

    if ( !start ) {
        start = 0;
    }
    else if ( start < 0 ) {
        start = size + start;

        if ( start < 0 ) start = 0;
    }
    else if ( start > size ) {
        start = size;
    }

    if ( !end ) {
        end = size;
    }
    else if ( end < 0 ) {
        end = size + end;

        if ( end < 0 ) end = 0;
    }
    else if ( end > size ) {
        end = size;
    }

    if ( start > end ) {
        [ start, end ] = [ end, start ];
    }

    const buffer = Buffer.alloc( end - start ),
        fd = await fs.promises.open( filePath );

    await fs.promises.read( fd, buffer, 0, end - start, start );

    await fs.promises.close( fd );

    return buffer;
}

export function sliceFileSync ( filePath, start, end ) {
    const size = fs.statSync( filePath ).size;

    if ( !start ) {
        start = 0;
    }
    else if ( start < 0 ) {
        start = size + start;

        if ( start < 0 ) start = 0;
    }
    else if ( start > size ) {
        start = size;
    }

    if ( !end ) {
        end = size;
    }
    else if ( end < 0 ) {
        end = size + end;

        if ( end < 0 ) end = 0;
    }
    else if ( end > size ) {
        end = size;
    }

    if ( start > end ) {
        [ start, end ] = [ end, start ];
    }

    const buffer = Buffer.alloc( end - start ),
        fd = fs.openSync( filePath );

    fs.readSync( fd, buffer, 0, end - start, start );

    fs.closeSync( fd );

    return buffer;
}

// private
function isFullMode ( mode ) {
    return mode.length === 9 && !mode.includes( " " );
}

function isBaseModeRequired ( mode ) {
    if ( isFullMode( mode ) ) {
        return mode.includes( "?" );
    }
    else {
        return true;
    }
}
