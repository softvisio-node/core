#!/usr/bin/env node

import Cli from "#lib/cli";
import externalResources from "#lib/external-resources";

const CLI = {
    "title": "Update resources",
    "options": {
        "force": {
            "description": "Force build",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        },
    },
};

await Cli.parse( CLI );

externalResources.add( "softvisio-node/core/data/http", import.meta.url );
externalResources.add( "softvisio-node/core/data/public-suffixes", import.meta.url );
externalResources.add( "softvisio-node/core/data/subnets", import.meta.url );
externalResources.add( "softvisio-node/core/data/tld", import.meta.url );

const res = await externalResources.update( {
    "remote": true,
    "force": process.cli.options.force,
    "silent": false,
} );

if ( !res.ok ) process.exit( 1 );
