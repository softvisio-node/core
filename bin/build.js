#!/usr/bin/env node

import Cli from "#lib/cli";
import ExternalResourceBuilder from "#lib/external-resource-builder";
import Certificates from "#lib/external-resources/certificates";
import Ffmpeg from "#lib/external-resources/ffmpeg-win32";
import Geolite2Asn from "#lib/external-resources/geolite2-asn";
import Geolite2City from "#lib/external-resources/geolite2-city";
import Geolite2Country from "#lib/external-resources/geolite2-country";
import GoogleChromeHeadlessShellStableDarwinX64 from "#lib/external-resources/google-chrome-headless-shell-stable-darwin-x64";
import GoogleChromeHeadlessShellStableLinuxX64 from "#lib/external-resources/google-chrome-headless-shell-stable-linux-x64";
import GoogleChromeHeadlessShellStableWin32X64 from "#lib/external-resources/google-chrome-headless-shell-stable-win32-x64";
import GoogleGeotargets from "#lib/external-resources/google-geotargets";
import Http from "#lib/external-resources/http";
import Mime from "#lib/external-resources/mime";
import PublicSuffixes from "#lib/external-resources/public-suffixes";
import Subnets from "#lib/external-resources/subnets";
import Tld from "#lib/external-resources/tld";
import UserAgent from "#lib/external-resources/user-agent";

const CLI = {
    "title": "Build resources",
    "options": {
        "force": {
            "description": "force build",
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
        Certificates,
        Ffmpeg,
        Geolite2Asn,
        Geolite2City,
        Geolite2Country,
        GoogleChromeHeadlessShellStableDarwinX64,
        GoogleChromeHeadlessShellStableLinuxX64,
        GoogleChromeHeadlessShellStableWin32X64,
        GoogleGeotargets,
        Http,
        Mime,
        PublicSuffixes,
        Subnets,
        Tld,
        UserAgent,
    ],
    { "force": process.cli.options.force }
);

if ( !res.ok ) process.exit( 1 );
