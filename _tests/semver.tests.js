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

            [ "1.2.3", [ "patch", "a" ], "1.2.4-a.0" ],
            [ "1.2.3", [ "minor", "a" ], "1.3.0-a.0" ],
            [ "1.2.3", [ "major", "a" ], "2.0.0-a.0" ],

            // patch pre-release
            [ "1.2.3-b.0", [ "patch", null ], "1.2.3-b.1" ],
            [ "1.2.3-b.0", [ "patch", false ], "1.2.3" ],
            [ "1.2.3-b.0", [ "patch", "a" ], null ],
            [ "1.2.3-b.0", [ "patch", "b" ], "1.2.3-b.1" ],
            [ "1.2.3-b.0", [ "patch", "c" ], "1.2.3-c.0" ],

            [ "1.2.3-b.0", [ "minor", null ], "1.3.0" ],
            [ "1.2.3-b.0", [ "minor", false ], "1.3.0" ],
            [ "1.2.3-b.0", [ "minor", "a" ], "1.3.0-a.0" ],
            [ "1.2.3-b.0", [ "minor", "b" ], "1.3.0-b.0" ],
            [ "1.2.3-b.0", [ "minor", "c" ], "1.3.0-c.0" ],

            [ "1.2.3-b.0", [ "major", null ], "2.0.0" ],
            [ "1.2.3-b.0", [ "major", false ], "2.0.0" ],
            [ "1.2.3-b.0", [ "major", "a" ], "2.0.0-a.0" ],
            [ "1.2.3-b.0", [ "major", "b" ], "2.0.0-b.0" ],
            [ "1.2.3-b.0", [ "major", "c" ], "2.0.0-c.0" ],

            // minor pre-release
            [ "1.2.0-b.0", [ "patch", null ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "patch", false ], "1.2.0" ],
            [ "1.2.0-b.0", [ "patch", "a" ], null ],
            [ "1.2.0-b.0", [ "patch", "b" ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "patch", "c" ], "1.2.0-c.0" ],

            [ "1.2.0-b.0", [ "minor", null ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "minor", false ], "1.2.0" ],
            [ "1.2.0-b.0", [ "minor", "a" ], null ],
            [ "1.2.0-b.0", [ "minor", "b" ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "minor", "c" ], "1.2.0-c.0" ],

            [ "1.2.0-b.0", [ "major", null ], "2.0.0" ],
            [ "1.2.0-b.0", [ "major", false ], "2.0.0" ],
            [ "1.2.0-b.0", [ "major", "a" ], "2.0.0-a.0" ],
            [ "1.2.0-b.0", [ "major", "b" ], "2.0.0-b.0" ],
            [ "1.2.0-b.0", [ "major", "c" ], "2.0.0-c.0" ],

            // major pre-release
            [ "1.0.0-b.0", [ "patch", null ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "patch", false ], "1.0.0" ],
            [ "1.0.0-b.0", [ "patch", "a" ], null ],
            [ "1.0.0-b.0", [ "patch", "b" ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "patch", "c" ], "1.0.0-c.0" ],

            [ "1.0.0-b.0", [ "minor", null ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "minor", false ], "1.0.0" ],
            [ "1.0.0-b.0", [ "minor", "a" ], null ],
            [ "1.0.0-b.0", [ "minor", "b" ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "minor", "c" ], "1.0.0-c.0" ],

            [ "1.0.0-b.0", [ "major", null ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "major", false ], "1.0.0" ],
            [ "1.0.0-b.0", [ "major", "a" ], null ],
            [ "1.0.0-b.0", [ "major", "b" ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "major", "c" ], "1.0.0-c.0" ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                const version = new Semver( tests[ n ][ 0 ] ),
                    incremented = version.increment( ...tests[ n ][ 1 ], {
                        "throwErrors": false,
                    } );

                strictEqual( incremented?.toString() ?? null, tests[ n ][ 2 ] );
            } );
        }
    } );
} );
