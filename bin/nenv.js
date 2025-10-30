#!/usr/bin/env node

import childProcess from "node:child_process";
import { shellEscape } from "#lib/utils";

process.argv.shift();
process.argv.shift();

const env = {};

while ( process.argv.length ) {
    const arg = process.argv.shift();

    if ( arg === "--" ) break;

    if ( arg === "--preserve-symlinks" ) {
        env.NODE_PRESERVE_SYMLINKS = 1;
        env.NODE_PRESERVE_SYMLINKS_MAIN = 1;
    }
    else {
        const idx = arg.indexOf( "=" );

        if ( idx < 1 ) {
            console.warn( `Invalid nenv agrument: ${ arg }` );

            process.exit( 1 );
        }

        env[ arg.slice( 0, idx ) ] = arg.slice( idx + 1 );
    }
}

if ( !process.argv.length ) {
    console.warn( "Invalid nenv arguments" );

    process.exit( 1 );
}

const res = childProcess.spawnSync( shellEscape( process.argv ), {
    "cwd": process.cwd(),
    "env": {
        ...process.env,
        ...env,
    },
    "shell": true,
    "stdio": "inherit",
} );

process.exit( res.status );
