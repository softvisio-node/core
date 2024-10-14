#!/usr/bin/env node

import Browser from "#lib/browser";
import * as config from "#lib/config";
import externalResources from "#lib/external-resources";
import Server from "#lib/http/server";
import Interval from "#lib/interval";
import { sleep } from "#lib/utils";

const resource = await externalResources.add( "softvisio-node/core/resources/local.softvisio.net" ).check();

if ( new Interval( "1 week" ).toDate() >= new Date( resource.meta.expires ) ) {
    await externalResources.add( "softvisio-node/core/resources/local.softvisio.net" ).check( {
        "remote": true,
    } );
}

const defaultHttpsDomain = "local.softvisio.net",
    defaultHttpsCert = resource.location + "/certificate.pem",
    defaultHttpsKey = resource.location + "/key.pem";

const data = {
    "userAgent": null,
};

var headers = await getHeaders( "http:" );
parseHeaders( "http:", headers );

headers = await getHeaders( "https:" );
parseHeaders( "https:", headers );

const http = config.readConfig( "http.yaml" );

http[ "edge-windows" ] = data;

config.writeConfig( "http.yaml", http );

async function getHeaders ( protocol ) {
    return new Promise( resolve => {
        var server, browser;

        server = new Server( {
            "ssl": protocol === "https:",
            "cert_file_name": defaultHttpsCert,
            "key_file_name": defaultHttpsKey,
        } ).get( "/*", async req => {
            await req.end();

            browser?.close();

            await server.stop();

            await sleep( 10 );

            resolve( req.headers );
        } );

        server.start( { "port": 0 } ).then( async res => {
            if ( !res.ok ) throw res + "";

            const url = `${ protocol }//${ defaultHttpsDomain }:${ res.data.port }/`;

            browser = new Browser( url, {
                "incognito": true,
                "headless": true,
            } );
        } );
    } );
}

function parseHeaders ( type, headers ) {
    data[ type ] = {};

    for ( const [ name, value ] of headers.entries() ) {
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
            data[ type ][ originalName ] = value;
        }
    }
}
