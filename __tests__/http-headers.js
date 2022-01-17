import Headers from "#lib/http/headers";
import { camelToKebabCase } from "#lib/utils/naming-conventions";

const TESTS = [
    {
        "headers": {
            "set-cookie": `NID=511=aa5oLKcWk3LIApa6H6L96-iVlArOtXdB53uZ9_NjfnpNPm-SWyw1p9j-7aCIA8Kb5Q89c4vTPd5UszCxzwjDDMSD0uA8lt2P1KciCSyETyakac6usNXRvEMq3dZ-F8LPNitvoNomA7nVwNi5RGChw96c7rboFXGL1WjqU9p4Lc8; expires=Tue, 19-Jul-2022 12:53:28 GMT; path=/; domain=.google.com; Secure; HttpOnly; SameSite=none`,
        },
        "method": "getSetCookie",
        "result": [
            {
                "name": "a",
                "value": "b",
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

        expect( res ).toStrictEqual( res );
    } );
}
