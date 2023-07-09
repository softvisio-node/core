#!/usr/bin/env node

import Cli from "#lib/cli";
import PublicSuffixes from "#lib/resources/core1/public-suffixes";

const CLI = {
    "title": "Update resources",
    "options": {
        "build": {
            "description": "build resources",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        },
    },
};

await Cli.parse( CLI );

if ( process.cli.options.build ) {
    const res = await new PublicSuffixes().build();
    if ( !res.ok ) process.exit( 1 );
}

// const res = await resources.update( { "build": process.cli.options.build } );

// if ( !res.ok ) {
//     console.log( `Resources update error: ` + res );

//     process.exit( 3 );
// }
