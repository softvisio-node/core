#!/usr/bin/env node

import fs from "node:fs";
import Browser from "#lib/browser";
import * as certificates from "#lib/certificates";
import * as config from "#lib/config";
import Headers from "#lib/http/headers";
import Server from "#lib/http/server";

const PLATFORMS = {
    "linux": "(X11; Linux x86_64)",
    "win32": "(Windows NT 10.0; Win64; x64)",
};

var http;

if ( fs.existsSync( "http.json" ) ) {
    http = config.readConfig( "http.json" );
}
else {
    http = {};
}

await getChrome();

config.writeConfig( "http.json", http, { "readable": true } );

async function getChrome () {
    await Browser.installChrome( {
        "chromeHeadlessShell": true,
        "dependencies": true,
    } );

    var headers;

    // http
    headers = await getHeaders( "chrome-headless-shell", "http:", { "headless": true } );

    // http, win32
    addHeaders( "chrome-win32", "http:", headers, {
        "platform": PLATFORMS.win32,
    } );

    // http, linux
    addHeaders( "chrome-linux", "http:", headers, {
        "platform": PLATFORMS.linux,
    } );

    // https
    headers = await getHeaders( "chrome-headless-shell", "https:", { "headless": true } );

    // https, win32
    addHeaders( "chrome-win32", "https:", headers, {
        "platform": PLATFORMS.win32,
        "Sec-CH-UA-Platform": '"Windows"',
    } );

    // https, linux
    addHeaders( "chrome-linux", "https:", headers, {
        "platform": PLATFORMS.linux,
        "Sec-CH-UA-Platform": '"Linux"',
    } );
}

async function getHeaders ( browser, protocol, { headless = false } = {} ) {
    return new Promise( resolve => {
        var server, browser;

        server = new Server( {
            "certificatePath": protocol === "https:"
                ? certificates.localCertificatePath
                : null,
            "privateKeyPath": certificates.localPrivateKeyPath,
        } ).get( "/*", async req => {
            await req.end();

            browser?.close();

            await server.stop();

            resolve( req.headers );
        } );

        server.start( { "port": 0 } ).then( async res => {
            if ( !res.ok ) throw res + "";

            const url = `${ protocol }//${ certificates.localDomain }:${ res.data.port }/`;

            browser = new Browser( url, {
                browser,
                headless,
            } );
        } );
    } );
}

function addHeaders ( browser, protocol, headers, { platform, ...additionalHeaders } = {} ) {
    http[ browser ] ??= {
        "userAgent": null,
    };
    http[ browser ][ protocol ] = {};

    // clone headers
    headers = new Headers( {
        ...headers.toJSON(),
        "Accept-Language": "en-US,en;q=0.9",
        ...additionalHeaders,
    } );

    for ( const [ name, value ] of [ ...headers.entries() ].sort( ( a, b ) => a[ 0 ].localeCompare( b[ 0 ] ) ) ) {
        const originalName = headers.getOriginalName( name );

        if ( name === "user-agent" ) {
            http[ browser ][ "userAgent" ] = value.replaceAll( "Headless", "" );

            // patch platform
            if ( platform ) {
                if ( http[ browser ][ "userAgent" ].includes( PLATFORMS.linux ) ) {
                    http[ browser ][ "userAgent" ] = http[ browser ][ "userAgent" ].replace( PLATFORMS.linux, platform );
                }
                else if ( http[ browser ][ "userAgent" ].includes( PLATFORMS.win32 ) ) {
                    http[ browser ][ "userAgent" ] = http[ browser ][ "userAgent" ].replace( PLATFORMS.win32, platform );
                }
                else {
                    throw new Error( `Unable to patch platform for user agent: ${ value }` );
                }
            }
        }
        else if ( name === "dnt" ) {
            http[ browser ][ protocol ][ originalName ] = value;
        }
        else if ( name === "accept" ) {
            http[ browser ][ protocol ][ originalName ] = value;
        }
        else if ( name === "accept-language" ) {
            http[ browser ][ protocol ][ originalName ] = value;
        }
        else if ( name.startsWith( "sec-" ) ) {
            http[ browser ][ protocol ][ originalName ] = value.replaceAll( "Headless", "" );
        }
    }
}
