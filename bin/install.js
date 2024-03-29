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

externalResources.add( "softvisio-node/core/resources/geolite2-country" );
externalResources.add( "softvisio-node/core/resources/http" );
externalResources.add( "softvisio-node/core/resources/public-suffixes" );
externalResources.add( "softvisio-node/core/resources/subnets" );
externalResources.add( "softvisio-node/core/resources/tld" );

const res = await externalResources.update( {
    "force": process.cli.options.force,
    "silent": false,
} );

if ( !res.ok ) process.exit( 1 );
