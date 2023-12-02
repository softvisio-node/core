#!/usr/bin/env node

import Cli from "#lib/cli";
import ExternalResourceBuilder from "#lib/external-resource-builder";
import Geolite2Country from "#lib/external-resources/geolite2-country";
import Geolite2City from "#lib/external-resources/geolite2-city";
import Http from "#lib/external-resources/http";
import PublicSuffixes from "#lib/external-resources/public-suffixes";
import Subnets from "#lib/external-resources/subnets";
import Tld from "#lib/external-resources/tld";

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

const res = await ExternalResourceBuilder.build(
    [

        //
        Geolite2Country,
        Geolite2City,
        Http,
        PublicSuffixes,
        Subnets,
        Tld,
    ],
    { "force": process.cli.options.force }
);

if ( !res.ok ) process.exit( 1 );
