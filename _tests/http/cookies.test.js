#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Browser from "#lib/browser";
import fetch from "#lib/fetch";
import Cookie from "#lib/http/cookie";
import Server from "#lib/http/server";
import { sleep } from "#lib/utils";

const TESTS = [
    {
        "name": `test1`,
        "value": ` test- \x04-;",\\ мама`,
    },
    {
        "name": "test",
    },
    {
        "value": "test",
    },
    {
        "name": "test",
        "value": "test",
        "path": "/aaa;/мама",
    },
];

suite( "http", () => {
    suite( "cookies", () => {
        suite( "browser", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "", async () => {
                    await testCookies( TESTS[ n ], true );
                } );
            }
        } );

        suite( "fetch", () => {
            for ( let n = 0; n < TESTS.length; n++ ) {
                test( n + "", async () => {
                    await testCookies( TESTS[ n ], false );
                } );
            }
        } );
    } );
} );

async function testCookies ( cookie, useBrowser ) {
    cookie = Cookie.new( cookie );

    const headers = await new Promise( resolve => {
        var server, browser;

        server = new Server().get( "/*", async req => {
            if ( req.url.searchParams?.has( "done" ) ) {
                await req.end();

                browser?.close();

                await server.stop();

                await sleep( 5 );

                resolve( req.headers );
            }
            else {
                await req.end( {
                    "status": 307,
                    "headers": {
                        "location": `${ cookie.path || "/" }?done`,
                        "set-cookie": cookie,
                    },
                } );
            }
        } );

        server.start().then( res => {
            if ( !res.ok ) throw res + "";

            const url = "http://local.softvisio.net/";

            if ( useBrowser ) {
                browser = new Browser( url, {
                    "incognito": true,
                    "headless": true,
                } );
            }
            else {
                fetch( url, {
                    "cookies": true,
                } );
            }
        } );
    } );

    strictEqual( headers.cookie[ cookie.name ]?.value, cookie.value );
}
