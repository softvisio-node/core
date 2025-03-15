import fs from "node:fs";
import * as bits from "#lib/bits";

const PERMISSION_INDEX = {
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

        for ( const group of mode.split( / +/ ) ) {

            // +rwx, u+rwx go-x
            const match = group.match( /^([gou]{1,3})?([+-])([rwx]{1,3})$/ );

            if ( !match ) throw new Error( `File mode "${ mode }" is not valid` );

            const users = match[ 1 ] || "ugo",
                sign = match[ 2 ],
                permissions = match[ 3 ];

            for ( const user of users ) {
                for ( const permission of permissions ) {
                    const idx = PERMISSION_INDEX[ user + permission ];

                    fullMode[ idx ] = sign === "-"
                        ? "-"
                        : permission;
                }
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
    const { size } = await fs.promises.stat( filePath );

    [ start, end ] = calculateSliceParams( start, end, size );

    const buffer = Buffer.alloc( end - start ),
        fh = await fs.promises.open( filePath );

    await fh.read( buffer, 0, end - start, start );

    await fh.close();

    return buffer;
}

export function sliceFileSync ( filePath, start, end ) {
    const { size } = fs.statSync( filePath );

    [ start, end ] = calculateSliceParams( start, end, size );

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

function calculateSliceParams ( start, end, size ) {
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

    if ( end == null ) {
        end = size;
    }
    else if ( !end ) {
        end = 0;
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

    return [ start, end ];
}
