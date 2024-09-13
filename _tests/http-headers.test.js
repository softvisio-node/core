#!/usr/bin/env node

import { suite, test } from "node:test";
import assert from "node:assert";
import Headers from "#lib/http/headers";
import { camelToKebabCase } from "#lib/naming-conventions";

const TESTS = [

    // accept-encoding
    {
        "headers": {
            "accept-encoding": `br;q=0.1, deflate, gzip;q=1.0, *;q=0.5    `,
        },
        "method": "acceptEncoding",
        "result": [ "deflate", "gzip", "*", "br" ],
    },

    // cookie
    {
        "headers": {
            "cookie": `a=1; b = 2 ; c=  1=2 3   `,
        },
        "method": "cookie",
        "result": {
            "a": "1",
            "b": "2",
            "c": "1=2 3",
        },
    },

    // set-cookie
    {
        "headers": {
            "set-cookie": `name=val; expires=Tue, 19-Jul-2022 12:53:28 GMT; path=/  ; domain = .google.com  ;Secure; HttpOnly; SameSite=none`,
        },
        "method": "setCookie",
        "result": [
            {
                "name": `name`,
                "value": `val`,
                "expires": new Date( `Tue, 19-Jul-2022 12:53:28 GMT` ),
                "path": `/`,
                "domain": `.google.com`,
                "secure": true,
                "httpOnly": true,
                "sameSite": "none",
            },
        ],
    },

    // www-authenticate
    {
        "headers": {
            "www-authenticate": `Digest realm="Test realm, with comma",   uri    =  "/"   , qop="auth, auth-int", algorithm=SHA-256   , nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", opaque = "FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS"    `,
        },
        "method": "wwwAuthenticate",
        "result": {
            "scheme": "digest",
            "realm": "Test realm, with comma",
            "uri": "/",
            "qop": "auth, auth-int",
            "algorithm": "SHA-256",
            "nonce": "7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v",
            "opaque": "FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS",
        },
    },

    // content-disposition
    {
        "headers": {
            "content-disposition": `   form-data  ;    name = file  ; filename = "${ Buffer.from( "тест" ).toString( "binary" ) }-%22-;-.txt" ; fake1; fake2 = 234  `,
        },
        "method": "contentDisposition",
        "result": {
            "type": "form-data",
            "name": "file",
            "filename": `тест-"-;-.txt`,
        },
    },
];

suite( "http", () => {
    for ( let n = 0; n < TESTS.length; n++ ) {
        const _test = TESTS[ n ],
            id = `http-headers-${ camelToKebabCase( _test.method ) }-${ n }`;

        test( `${ id }`, () => {
            const headers = new Headers( _test.headers );

            const res = typeof headers[ _test.method ] === "function"
                ? headers[ _test.method ]()
                : headers[ _test.method ];

            // console.log( "expected:", JSON.stringify( _test.result, null, 4 ) );
            // console.log( "result:", JSON.stringify( res, null, 4 ) );

            assert.deepStrictEqual( res, _test.result );
        } );
    }
} );
