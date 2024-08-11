#!/usr/bin/env node

import childProcess from "node:child_process";

process.argv.shift();
process.argv.shift();

while ( process.argv.length ) {
    const arg = process.argv.shift();

    if ( arg === "--" ) break;

    if ( arg === "--preserve-symlinks" ) {
        process.env.NODE_PRESERVE_SYMLINKS = 1;
        process.env.NODE_PRESERVE_SYMLINKS_MAIN = 1;
    }
    else {
        const idx = arg.indexOf( "=" );

        if ( idx < 1 ) {
            console.warn( `Invalid nenv agrument: ${ arg }` );

            process.exit( 1 );
        }

        process.env[ arg.substring( 0, idx ) ] = arg.substring( idx + 1 );
    }
}

if ( !process.argv.length ) {
    console.warn( `Invalid nenv arguments` );

    process.exit( 1 );
}

const res = childProcess.spawnSync( process.argv.shift(), process.argv, {
    "stdio": "inherit",
    "shell": true,
} );

process.exit( res.status );
