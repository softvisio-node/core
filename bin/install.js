#!/usr/bin/env node

import Cli from "#lib/cli";
import externalResources from "#lib/external-resources";

const CLI = {
    "title": "Update resources",
    "options": {
        "force": {
            "description": "force update",
            "default": false,
            "schema": {
                "type": "boolean",
            },
        },
    },
};

await Cli.parse( CLI );

externalResources.add( "softvisio-node/core/resources/certificates" );
externalResources.add( "softvisio-node/core/resources/dh-params" );
externalResources.add( "softvisio-node/core/resources/geolite2-country" );
externalResources.add( "softvisio-node/core/resources/http" );
externalResources.add( "softvisio-node/core/resources/mime" );
externalResources.add( "softvisio-node/core/resources/public-suffixes" );
externalResources.add( "softvisio-node/core/resources/subnets" );
externalResources.add( "softvisio-node/core/resources/tld" );
externalResources.add( "softvisio-node/core/resources/user-agent" );

const res = await externalResources.install( {
    "force": process.cli.options.force,
} );

if ( !res.ok ) process.exit( 1 );
