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

externalResources.add( "c0rejs/core/resources/certificates" );
externalResources.add( "c0rejs/core/resources/dh-params" );
externalResources.add( "c0rejs/core/resources/geolite2-country" );
externalResources.add( "c0rejs/core/resources/http" );
externalResources.add( "c0rejs/core/resources/mime" );
externalResources.add( "c0rejs/core/resources/public-suffixes" );
externalResources.add( "c0rejs/core/resources/subnets" );
externalResources.add( "c0rejs/core/resources/tld" );
externalResources.add( "c0rejs/core/resources/user-agent" );

const res = await externalResources.install( {
    "force": process.cli.options.force,
} );

if ( !res.ok ) process.exit( 1 );
