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

            if ( Array.isArray( tests[ n ].property ) ) {
                [ property, ...args ] = tests[ n ].property;
            }
            else {
                property = tests[ n ].property;
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

suite( "glob-pattern", () => {
    suite( "static-pattern", () => {
        const tests = [
            {
                "pattern": [
                    "path",
                    {
                        "caseSensitive": false,
                    },
                ],
                "property": [ "test", "PATH" ],
                "result": true,
            },
            {
                "pattern": [
                    "path",
                    {
                        "caseSensitive": true,
                    },
                ],
                "property": [ "test", "PATH" ],
                "result": false,
            },
            {
                "pattern": [
                    "aaa/bbb",
                    {
                        "caseSensitive": true,
                    },
                ],
                "property": [ "test", "aaa/bbb" ],
                "result": true,
            },

            // prefix, normalize
            {
                "pattern": [
                    "aaa/ccc///aaa/bbb",
                    {
                        "caseSensitive": true,
                    },
                ],
                "property": [
                    "test",
                    "aaa/bbb",
                    {
                        "prefix": "aaa/bbb\\../ccc\\\\",
                        "normalize": true,
                    },
                ],
                "result": true,
            },
        ];

        testPattern( tests );
    } );

    suite( "dynamic-pattern", () => {
        const tests = [
            {
                "pattern": [
                    "**",
                    {
                        "caseSensitive": false,
                    },
                ],
                "property": [ "test", "PATH" ],
                "result": true,
            },
            {
                "pattern": [
                    "/**",
                    {
                        "caseSensitive": false,
                    },
                ],
                "property": [ "test", "/aaa/bbb/ccc" ],
                "result": true,
            },
            {
                "pattern": [
                    "/**/",
                    {
                        "caseSensitive": false,
                    },
                ],
                "property": [ "test", "/aaa/bbb/ccc/" ],
                "result": true,
            },
        ];

        testPattern( tests );
    } );
} );
