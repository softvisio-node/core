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
};

for ( const name in tests ) {
    for ( const _test of tests[name].tests ) {
        test( `${name}_${_test[0]}`, () => {
            expect( namingConventions[tests[name].method]( _test[0], tests[name].options || {} ) ).toBe( _test[1] );
        } );
    }
}
