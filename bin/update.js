#!/usr/bin/env node

import Cli from "#lib/cli";
import resources from "#lib/hostname/resources";

const CLI = {
    "title": "Update datasets",
    "options": {
        "build": {
            "description": "build datasets",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        },
    },
};

await Cli.parse( CLI );

const res = await resources.update( { "build": process.cli.options.build } );

if ( !res.ok ) {
    console.log( `Datasets update error: ` + res );

    process.exit( 3 );
}
