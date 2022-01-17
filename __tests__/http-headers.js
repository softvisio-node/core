import Headers from "#lib/http/headers";
import { camelToKebabCase } from "#lib/utils/naming-conventions";

const TESTS = [
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
