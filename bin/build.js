#!/usr/bin/env node

import Cli from "#lib/cli";
import ExternalResourceBuilder from "#lib/external-resource-builder";
import Geolite2Asn from "#lib/external-resources/geolite2-asn";
import Geolite2City from "#lib/external-resources/geolite2-city";
import Geolite2Country from "#lib/external-resources/geolite2-country";
import Http from "#lib/external-resources/http";
import PublicSuffixes from "#lib/external-resources/public-suffixes";
import Subnets from "#lib/external-resources/subnets";
import Tld from "#lib/external-resources/tld";
import GoogleGeotargets from "#lib/external-resources/google-geotargets";

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
        Geolite2Asn,
        Geolite2City,
        Geolite2Country,
        GoogleGeotargets,
        Http,
        PublicSuffixes,
        Subnets,
        Tld,
    ],
    { "force": process.cli.options.force }
);

if ( !res.ok ) process.exit( 1 );
