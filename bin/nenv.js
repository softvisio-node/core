#!/usr/bin/env node

import childProcess from "child_process";

process.argv.shift();
process.argv.shift();

while ( process.argv.length ) {
    const arg = process.argv.shift();

    const idx = arg.indexOf( "=" );

    if ( idx < 1 ) {
        process.argv.unshift( arg );

        break;
    }

    process.env[ arg.substring( 0, idx ) ] = arg.substring( idx + 1 );
}

if ( !process.argv.length ) process.exit( 2 );

const res = childProcess.spawnSync( process.argv.shift(), process.argv, { "stdio": "inherit", "shell": true } );

process.exit( res.status );
