#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import GlobBraces from "#lib/glob/braces";

suite( "glob-braces", () => {
    const tests = [

        //
        [ "{}", "{}" ],
        [ "{,}", "" ],
        [ "{,,}", "" ],
    ];

    for ( let n = 0; n < tests.length; n++ ) {
        test( n + "", () => {
            const [ pattern, res ] = tests[ n ],
                globBraces = new GlobBraces( pattern );

            strictEqual( globBraces.expand(), res );
        } );
    }
} );
