import * as namingConventions from "#lib/utils/naming-conventions";

const tests = {
    "isCamelCase": [

        //
        ["aaaBBB", true],
    ],
};

for ( const method in tests ) {
    for ( const _test of tests[method] ) {
        test( `${method}_${_test[0]}`, () => {
            expect( namingConventions[method]( _test[0], _test[2] ) ).toBe( _test[1] );
        } );
    }
}
