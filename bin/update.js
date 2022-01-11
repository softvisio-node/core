#!/usr/bin/env node

import Cli from "#lib/cli";
import hostnameResources from "#lib/hostname/resources";
import httpResources from "#lib/http/resources";

const CLI = {
    "title": "Update datasets",
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

console.log( fetch.resources );
process.exit();

await Cli.parse( CLI );

var res;

res = await hostnameResources.update( { "build": process.cli.options.build } );

if ( !res.ok ) {
    console.log( `Hostname resources update error: ` + res );

    process.exit( 3 );
}

res = await httpResources.update( { "build": process.cli.options.build } );

if ( !res.ok ) {
    console.log( `Http resources update error: ` + res );

    process.exit( 3 );
}
