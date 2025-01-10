#!/usr/bin/env node

import fs from "node:fs";
import Browser from "#lib/browser";
import * as certificates from "#lib/certificates";
import * as config from "#lib/config";
import Server from "#lib/http/server";

const data = {
    "userAgent": null,
};

var headers = await getHeaders( "msedge", "http:", { "headless": false } );
parseHeaders( "http:", headers );

headers = await getHeaders( "msedge", "https:", { "headless": false } );
parseHeaders( "https:", headers );

var http;

if ( fs.existsSync( "http.json" ) ) {
    http = config.readConfig( "http.json" );
}
else {
    http = {};
}

http[ "edge-windows" ] = data;

config.writeConfig( "http.json", http, { "readable": true } );

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

function parseHeaders ( type, headers ) {
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
