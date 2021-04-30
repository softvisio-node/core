#!/usr/bin/env node

import "#index";

import maxmind from "#lib/maxmind";

const ok = await maxmind.update( { "force": true } );

if ( !ok ) {
    console.log( `Maxmind update error.` );

    process.exit( 3 );
}
