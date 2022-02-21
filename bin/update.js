#!/usr/bin/env node

import Cli from "#lib/cli";
import resources from "#lib/resources/core";

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

const res = await resources.update( { "build": process.cli.options.build } );

if ( !res.ok ) {
    console.log( `Resources update error: ` + res );

    process.exit( 3 );
}
