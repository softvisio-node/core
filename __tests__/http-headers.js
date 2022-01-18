import Headers from "#lib/http/headers";
import { camelToKebabCase } from "#lib/utils/naming-conventions";

const TESTS = [

    // cookkie
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

    // set-cookkie
    {
        "headers": {
            "set-cookie": `name=val; expires=Tue, 19-Jul-2022 12:53:28 GMT; path=/; domain=.google.com; Secure; HttpOnly; SameSite=none`,
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
            "www-authenticate": `Digest realm="Test realm, with comma",   uri    =  "/"   , qop="auth, auth-int", algorithm=SHA-256, nonce="7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v", opaque = "FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS"    `,
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
];

for ( let n = 0; n < TESTS.length; n++ ) {
    const _test = TESTS[n],
        id = `http-headers-${camelToKebabCase( _test.method )}-${n}`;

    test( `${id}`, () => {
        const headers = new Headers( _test.headers );

        const res = typeof headers[_test.method] === "function" ? headers[_test.method]() : headers[_test.method];

        expect( res ).toStrictEqual( _test.result );
    } );
}
