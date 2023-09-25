import * as namingConventions from "#lib/naming-conventions";

const tests = {
    "isSnakeCase": {
        "method": "isSnakeCase",
        "options": null,
        "tests": [

            //
            ["a", true],
            ["a_b", true],
            ["ab12_wsd", true],

            ["A", false],
        ],
    },

    "isCamelCase": {
        "method": "isCamelCase",
        "options": null,
        "tests": [

            //
            ["a", true],
            ["aaa", true],
            ["aaaBBB", true],

            ["A", false],
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

    "isPascalCase": {
        "method": "isPascalCase",
        "options": null,
        "tests": [

            //
            ["AaaBBB", true],

            ["aaaBBB", false],
        ],
    },

    "isPascalCaseStrict": {
        "method": "isPascalCase",
        "options": { "strict": true },
        "tests": [

            //
            ["A", true],
            ["AaBb", true],
            ["AaBbC", true],

            ["a", false],
            ["aaa", false],
            ["ABB", false],
            ["ABBc", false],
            ["ABbbCC", false],
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
