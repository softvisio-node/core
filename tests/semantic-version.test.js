#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import SemanticVersion from "#lib/semantic-version";

suite( "semantic-version", () => {
    suite( "constructor", () => {
        const tests = [

            //
            [ "0.0.0", "0.0.0" ],
            [ null, undefined ],
            [ "1", "1.0.0" ],
            [ "1.2", "1.2.0" ],
            [ "1.2.3", "1.2.3" ],
            [ "-1.2.3", undefined ],
            [ "1.2.3-a.1+b.1", "1.2.3-a.1+b.1" ],
            [ "1.2.3-a.1+тест.1", undefined ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                try {
                    var version = SemanticVersion.new( tests[ n ][ 0 ] );
                }
                catch {}

                strictEqual( version?.version, tests[ n ][ 1 ] );
            } );
        }
    } );

    suite( "properties", () => {
        const tests = [

            //
            [ "0.0.0", "isPatch", true ],
            [ "0.0.0", "isMinor", false ],
            [ "0.0.0", "isMajor", false ],

            [ "1.2.3", "isPatch", true ],
            [ "1.2.3", "isMinor", false ],
            [ "1.2.3", "isMajor", false ],

            [ "1.2.0", "isPatch", false ],
            [ "1.2.0", "isMinor", true ],
            [ "1.2.0", "isMajor", false ],

            [ "1.0.0", "isPatch", false ],
            [ "1.0.0", "isMinor", false ],
            [ "1.0.0", "isMajor", true ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                const version = SemanticVersion.new( tests[ n ][ 0 ] );

                strictEqual( version[ tests[ n ][ 1 ] ], tests[ n ][ 2 ] );
            } );
        }
    } );

    suite( "compare", () => {
        const tests = [

            //
            [ "0.0.0", "0.0.0", 0 ],

            [ "1.2.3", "1.2.3", 0 ],
            [ "1.2.3", "1.2.1", 1 ],
            [ "1.2.3", "1.2.4", -1 ],

            [ "1.2.3-b.2", "1.2.3-a.1", 1 ],
            [ "1.2.3-b.2", "1.2.3-b.1", 1 ],
            [ "1.2.3-b.2", "1.2.3-b.3", -1 ],
            [ "1.2.3-b.2", "1.2.3-c.1", -1 ],
            [ "1.2.3-b.2", "1.2.3-b", 1 ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                strictEqual( SemanticVersion.compare( tests[ n ][ 0 ], tests[ n ][ 1 ] ), tests[ n ][ 2 ] );
            } );
        }
    } );

    suite( "increment", () => {
        const tests = [

            //
            [ "0.0.0", [ "patch" ], "0.0.1" ],
            [ "0.0.0", [ "minor" ], "0.1.0" ],
            [ "0.0.0", [ "major" ], "1.0.0" ],

            [ "1.2.3", [ "patch" ], "1.2.4" ],
            [ "1.2.3", [ "minor" ], "1.3.0" ],
            [ "1.2.3", [ "major" ], "2.0.0" ],

            [ "1.2.3", [ "patch", { "preReleaseTag": "a" } ], "1.2.4-a.0" ],
            [ "1.2.3", [ "minor", { "preReleaseTag": "a" } ], "1.3.0-a.0" ],
            [ "1.2.3", [ "major", { "preReleaseTag": "a" } ], "2.0.0-a.0" ],

            // patch pre-release
            [ "1.2.3-b.0", [ "patch", { "preReleaseTag": null } ], "1.2.3-b.1" ],
            [ "1.2.3-b.0", [ "patch", { "preReleaseTag": false } ], "1.2.3" ],
            [ "1.2.3-b.0", [ "patch", { "preReleaseTag": "a" } ], null ],
            [ "1.2.3-b.0", [ "patch", { "preReleaseTag": "b" } ], "1.2.3-b.1" ],
            [ "1.2.3-b.0", [ "patch", { "preReleaseTag": "c" } ], "1.2.3-c.0" ],

            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": null } ], null ],
            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": null, "defaultPreReleaseTag": "a" } ], "1.3.0-a.0" ],
            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": false } ], "1.3.0" ],
            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": "a" } ], "1.3.0-a.0" ],
            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": "b" } ], "1.3.0-b.0" ],
            [ "1.2.3-b.0", [ "minor", { "preReleaseTag": "c" } ], "1.3.0-c.0" ],

            [ "1.2.3-b.0", [ "major", { "preReleaseTag": null } ], null ],
            [ "1.2.3-b.0", [ "major", { "preReleaseTag": null, "defaultPreReleaseTag": "a" } ], "2.0.0-a.0" ],
            [ "1.2.3-b.0", [ "major", { "preReleaseTag": false } ], "2.0.0" ],
            [ "1.2.3-b.0", [ "major", { "preReleaseTag": "a" } ], "2.0.0-a.0" ],
            [ "1.2.3-b.0", [ "major", { "preReleaseTag": "b" } ], "2.0.0-b.0" ],
            [ "1.2.3-b.0", [ "major", { "preReleaseTag": "c" } ], "2.0.0-c.0" ],

            // minor pre-release
            [ "1.2.0-b.0", [ "patch", { "preReleaseTag": null } ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "patch", { "preReleaseTag": false } ], "1.2.0" ],
            [ "1.2.0-b.0", [ "patch", { "preReleaseTag": "a" } ], null ],
            [ "1.2.0-b.0", [ "patch", { "preReleaseTag": "b" } ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "patch", { "preReleaseTag": "c" } ], "1.2.0-c.0" ],

            [ "1.2.0-b.0", [ "minor", { "preReleaseTag": null } ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "minor", { "preReleaseTag": false } ], "1.2.0" ],
            [ "1.2.0-b.0", [ "minor", { "preReleaseTag": "a" } ], null ],
            [ "1.2.0-b.0", [ "minor", { "preReleaseTag": "b" } ], "1.2.0-b.1" ],
            [ "1.2.0-b.0", [ "minor", { "preReleaseTag": "c" } ], "1.2.0-c.0" ],

            [ "1.2.0-b.0", [ "major", { "preReleaseTag": null } ], null ],
            [ "1.2.0-b.0", [ "major", { "preReleaseTag": null, "defaultPreReleaseTag": "a" } ], "2.0.0-a.0" ],
            [ "1.2.0-b.0", [ "major", { "preReleaseTag": false } ], "2.0.0" ],
            [ "1.2.0-b.0", [ "major", { "preReleaseTag": "a" } ], "2.0.0-a.0" ],
            [ "1.2.0-b.0", [ "major", { "preReleaseTag": "b" } ], "2.0.0-b.0" ],
            [ "1.2.0-b.0", [ "major", { "preReleaseTag": "c" } ], "2.0.0-c.0" ],

            // major pre-release
            [ "1.0.0-b.0", [ "patch", { "preReleaseTag": null } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "patch", { "preReleaseTag": false } ], "1.0.0" ],
            [ "1.0.0-b.0", [ "patch", { "preReleaseTag": "a" } ], null ],
            [ "1.0.0-b.0", [ "patch", { "preReleaseTag": "b" } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "patch", { "preReleaseTag": "c" } ], "1.0.0-c.0" ],

            [ "1.0.0-b.0", [ "minor", { "preReleaseTag": null } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "minor", { "preReleaseTag": false } ], "1.0.0" ],
            [ "1.0.0-b.0", [ "minor", { "preReleaseTag": "a" } ], null ],
            [ "1.0.0-b.0", [ "minor", { "preReleaseTag": "b" } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "minor", { "preReleaseTag": "c" } ], "1.0.0-c.0" ],

            [ "1.0.0-b.0", [ "major", { "preReleaseTag": null } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "major", { "preReleaseTag": false } ], "1.0.0" ],
            [ "1.0.0-b.0", [ "major", { "preReleaseTag": "a" } ], null ],
            [ "1.0.0-b.0", [ "major", { "preReleaseTag": "b" } ], "1.0.0-b.1" ],
            [ "1.0.0-b.0", [ "major", { "preReleaseTag": "c" } ], "1.0.0-c.0" ],
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                const version = SemanticVersion.new( tests[ n ][ 0 ] );

                try {
                    const incremented = version.increment( ...tests[ n ][ 1 ] );

                    strictEqual( incremented?.toString(), tests[ n ][ 2 ] );
                }
                catch ( e ) {
                    if ( tests[ n ][ 2 ] != null ) {
                        throw e;
                    }
                }
            } );
        }
    } );
} );
