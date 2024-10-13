#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Browser from "#lib/browser";
import Cookie from "#lib/http/cookie";
import Server from "#lib/http/server";
import { sleep } from "#lib/utils";

const TESTS = [
    {
        "name": `test1`,
        "value": ` test- \x04-;",\\ мама`,
    },
    {
        "name": "test1",
    },
    {
        "value": "test1",
    },
];

suite( "http", () => {
    suite( "cookies", () => {
        for ( let n = 0; n < TESTS.length; n++ ) {
            test( n + "", async () => {
                await testCookies( TESTS[ n ] );
            } );
        }
    } );
} );

async function testCookies ( cookie ) {
    cookie = Cookie.new( cookie );

    const headers = await new Promise( resolve => {
        var server, browser;

        server = new Server().get( "/*", async req => {
            if ( req.url.pathname === "/done" ) {
                await req.end();

                browser.close();

                await server.stop();

                await sleep( 1 );

                resolve( req.headers );
            }
            else {
                await req.end( {
                    "status": 307,
                    "headers": {
                        "location": "/done",
                        "set-cookie": cookie,
                    },
                } );
            }
        } );

        server.start().then( res => {
            browser = new Browser( "http://local.softvisio.net/", {
                "incognito": true,
                "headless": true,
            } );
        } );
    } );

    strictEqual( headers.cookie[ cookie.name ]?.value, cookie.value );
}
