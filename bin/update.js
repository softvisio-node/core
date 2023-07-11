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

await externalResources.add( "softvisio-node/core/resources/geolite2-country", import.meta.url, { "update": false } );
await externalResources.add( "softvisio-node/core/resources/http", import.meta.url, { "update": false } );
await externalResources.add( "softvisio-node/core/resources/public-suffixes", import.meta.url, { "update": false } );
await externalResources.add( "softvisio-node/core/resources/subnets", import.meta.url, { "update": false } );
await externalResources.add( "softvisio-node/core/resources/tld", import.meta.url, { "update": false } );

const res = await externalResources.update( {
    "remote": true,
    "force": process.cli.options.force,
    "silent": false,
} );

if ( !res.ok ) process.exit( 1 );
