#!/usr/bin/env node

import fs from "node:fs";
import Browser from "#lib/browser";
import * as certificates from "#lib/certificates";
import * as config from "#lib/config";
import Server from "#lib/http/server";

var http;

if ( fs.existsSync( "http.json" ) ) {
    http = config.readConfig( "http.json" );
}
else {
    http = {};
}

await getMsedge();
await getChrome();

config.writeConfig( "http.json", http, { "readable": true } );

// XXX msedge-linux
// XXX headless mode
async function getMsedge () {
    if ( process.platform !== "win32" ) return;

    const data = {
        "userAgent": null,
    };

    var headers = await getHeaders( "msedge", "http:", { "headless": false } );
    parseHeaders( data, "http:", headers );

    headers = await getHeaders( "msedge", "https:", { "headless": false } );
    parseHeaders( data, "https:", headers );

    http[ "msedge-win32" ] = data;
}

// XXX install goole chrome
// XXX chrome linux
async function getChrome () {
    await Browser.installChrome( {
        "chromeHeadlessShell": true,
        "dependencies": true,
    } );

    const data = {
        "userAgent": null,
    };

    var headers = await getHeaders( "chrome", "http:", { "headless": true } );
    parseHeaders( data, "http:", headers );

    headers = await getHeaders( "chrome", "https:", { "headless": true } );
    parseHeaders( data, "https:", headers );

    http[ "chrome-win32" ] = data;
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

function parseHeaders ( data, type, headers ) {
    data[ type ] = {};

    for ( const [ name, value ] of [ ...headers.entries() ].sort( ( a, b ) => a[ 0 ].localeCompare( b[ 0 ] ) ) ) {
        const originalName = headers.getOriginalName( name );

        if ( name === "user-agent" ) {
            data[ "userAgent" ] = value.replaceAll( "Headless", "" );
        }
        else if ( name === "dnt" ) {
            data[ type ][ originalName ] = value;
        }
        else if ( name === "accept" ) {
            data[ type ][ originalName ] = value;
        }
        else if ( name === "accept-language" ) {
            data[ type ][ originalName ] = value;
        }
        else if ( name.startsWith( "sec-" ) ) {
            data[ type ][ originalName ] = value.replaceAll( "Headless", "" );
        }
    }
}
