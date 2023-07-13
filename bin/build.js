#!/usr/bin/env node

import Cli from "#lib/cli";
import Geolite2Country from "#lib/external-resources/core/geolite2-country";
import Http from "#lib/external-resources/core/http";
import PublicSuffixes from "#lib/external-resources/core/public-suffixes";
import Subnets from "#lib/external-resources/core/subnets";
import Tld from "#lib/external-resources/core/tld";

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

var res;

res = await new Geolite2Country().build( { "force": process.cli.options.force } );
if ( !res.ok ) process.exit( 1 );

res = await new Http().build( { "force": process.cli.options.force } );
if ( !res.ok ) process.exit( 1 );

res = await new PublicSuffixes().build( { "force": process.cli.options.force } );
if ( !res.ok ) process.exit( 1 );

res = await new Subnets().build( { "force": process.cli.options.force } );
if ( !res.ok ) process.exit( 1 );

res = await new Tld().build( { "force": process.cli.options.force } );
if ( !res.ok ) process.exit( 1 );
