#!/usr/bin/env node

import Browser from "#lib/browser";
import certificates from "#lib/certificates";
import * as config from "#lib/config";
import Server from "#lib/http/server";
import { sleep } from "#lib/utils";

const data = {
    "userAgent": null,
};

var headers = await getHeaders( "http:" );
parseHeaders( "http:", headers );

headers = await getHeaders( "https:" );
parseHeaders( "https:", headers );

const http = config.readConfig( "http.json" );

http[ "edge-windows" ] = data;

config.writeConfig( "http.json", http, { "readable": true } );

async function getHeaders ( protocol, headless = false ) {
    return new Promise( resolve => {
        var server, browser;

        server = new Server( {
            "ssl": protocol === "https:",
            "cert_file_name": certificates.defaultHttpsCertificate,
            "key_file_name": certificates.defaultHttpsKey,
        } ).get( "/*", async req => {
            await req.end();

            browser?.close();

            await server.stop();

            await sleep( 10 );

            resolve( req.headers );
        } );

        server.start( { "port": 0 } ).then( async res => {
            if ( !res.ok ) throw res + "";

            const url = `${ protocol }//${ certificates.defaultHttpsDomain }:${ res.data.port }/`;

            browser = new Browser( url, {
                "incognito": true,
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
