import fs from "node:fs";
import * as bits from "#lib/bits";

const MODE_INDEX = {
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

export function calculateMode ( mode, baseMode ) {
    if ( typeof mode === "number" ) return mode;

    if ( baseMode == null ) {
        baseMode = 0;
    }
    else if ( typeof baseMode === "string" ) {
        baseMode = calculateMode( baseMode );
    }

    if ( !isFullMode ) {
        const fullMode = "?????????";

        for ( const group of mode.split( " " ) ) {

            // +rwx
            if ( group.startsWith( "+" ) || group.startsWith( "-" ) ) {
                if ( group.length < 2 ) throw new Error( `File mode "${ mode }" is not valid` );

                for ( let n = 1; n <= group.length; n++ ) {
                    for ( const user of [ "u", "g", "o" ] ) {
                        const idx = MODE_INDEX[ user + group[ n ] ];

                        if ( idx == null ) throw new Error( `File mode "${ mode }" is not valid` );

                        fullMode[ idx ] = group[ 0 ] === "-"
                            ? "-"
                            : group[ n ];
                    }
                }
            }

            // u+rwx
            else if ( group.startsWith( "u" ) || group.startsWith( "g" ) || group.startsWith( "o" ) ) {
                if ( group.length < 3 ) throw new Error( `File mode "${ mode }" is not valid` );

                if ( group[ 1 ] !== "-" && group[ 1 ] !== "+" ) throw new Error( `File mode "${ mode }" is not valid` );

                for ( let n = 2; n <= group.length; n++ ) {
                    const idx = MODE_INDEX[ group[ 0 ] + group[ n ] ];

                    if ( idx == null ) throw new Error( `File mode "${ mode }" is not valid` );

                    fullMode[ idx ] = group[ 1 ] === "-"
                        ? "-"
                        : group[ n ];
                }
            }
            else {
                throw new Error( `File mode "${ mode }" is not valid` );
            }
        }

        mode = fullMode;
    }

    for ( let n = 0; n <= 8; n++ ) {

        // set permission
        if ( mode[ n ] === "-" ) {
            baseMode = bits.dropBits( baseMode, 2 ** ( 8 - n ) );
        }

        // drop permission
        else if ( mode[ n ] != null && mode[ n ] !== "?" ) {
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
