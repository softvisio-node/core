import * as namingConventions from "#lib/utils/naming-conventions";

const tests = {
    "isCamelCase": {
        "method": "isCamelCase",
        "options": null,
        "tests": [

            //
            ["aaaBBB", true],
        ],
    },
    "isCamelCaseStrict": {
        "method": "isCamelCase",
        "options": { "strict": true },
        "tests": [

            //
            ["aB", true],
            ["aBbb", true],
            ["aBbbC", true],

            ["Aaa", false],
            ["aBB", false],
            ["aBBc", false],
            ["aBbbCC", false],
        ],
    },
};

for ( const name in tests ) {
    for ( const _test of tests[name].tests ) {
        test( `${name}_${_test[0]}`, () => {
            expect( namingConventions[tests[name].method]( _test[0], tests[name].options || {} ) ).toBe( _test[1] );
        } );
    }
}
