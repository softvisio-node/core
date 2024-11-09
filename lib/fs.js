import fs from "node:fs";
import * as bits from "#lib/bits";

export function calculateMode ( mode, baseMode ) {
    if ( typeof mode === "number" ) return mode;

    baseMode ??= 0;

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
        if ( mode.includes( "?" ) ) {
            var { "mode": baseMode } = await fs.promises.stat( path );

            baseMode = baseMode & 0o777;
        }

        mode = calculateMode( mode, baseMode );
    }

    return fs.promises.chmod( path, mode );
}

export function chmodSync ( path, mode ) {
    if ( typeof mode === "string" ) {
        if ( mode.includes( "?" ) ) {
            var { "mode": baseMode } = fs.statSync( path );

            baseMode = baseMode & 0o777;
        }

        mode = calculateMode( mode, baseMode );
    }

    return fs.chmodSync( path, mode );
}
