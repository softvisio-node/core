#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import GlobPattern from "#lib/glob/pattern";

function testPattern ( tests ) {
    for ( let n = 0; n < tests.length; n++ ) {
        test( n + "", () => {
            const pattern = new GlobPattern( ...( Array.isArray( tests[ n ].pattern )
                ? tests[ n ].pattern
                : [ tests[ n ].pattern ] ) );

            let property, args, res;

            if ( Array.isArray( tests[ n ].test ) ) {
                [ property, ...args ] = tests[ n ].test;
            }
            else {
                property = tests[ n ].test;
                args = [];
            }

            if ( typeof pattern[ property ] === "function" ) {
                res = pattern[ property ]( ...args );
            }
            else {
                res = pattern[ property ];
            }

            strictEqual( res, tests[ n ].result );
        } );
    }
}

suite( "glob-patterns", () => {
    suite( "static", () => {
        const tests = [
            {
                "pattern": "aaa",
                "test": [ "test", "aaa" ],
                "result": true,
            },
        ];

        testPattern( tests );
    } );
} );
