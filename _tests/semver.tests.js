#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Semver from "#lib/semver";

suite( "semver", () => {
    suite( "increment", () => {
        const tests = [

            //
            [ "0.0.0", [ "patch" ], "0.0.1" ],
            [ "0.0.0", [ "minor" ], "0.1.0" ],
            [ "0.0.0", [ "major" ], "1.0.0" ],

            [ "1.2.3", [ "patch" ], "1.2.4" ],
            [ "1.2.3", [ "minor" ], "1.3.0" ],
            [ "1.2.3", [ "major" ], "2.0.0" ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                const version = new Semver( tests[ n ][ 0 ] ),
                    incremented = version.increment( ...tests[ n ][ 1 ] );

                strictEqual( incremented.toString(), tests[ n ][ 2 ] );
            } );
        }
    } );
} );
