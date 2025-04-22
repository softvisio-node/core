#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import * as namingConventions from "#lib/naming-conventions";

const tests = {
    "isSnakeCase": {
        "method": "isSnakeCase",
        "options": null,
        "tests": [

            //
            [ "a", true ],
            [ "a_b", true ],
            [ "ab12_wsd", true ],

            [ "A", false ],
        ],
    },

    "isCamelCase": {
        "method": "isCamelCase",
        "options": null,
        "tests": [

            //
            [ "a", true ],
            [ "aaa", true ],
            [ "aaaBBB", true ],

            [ "A", false ],
        ],
    },

    "isStrictCamelCase": {
        "method": "isCamelCase",
        "options": { "strict": true },
        "tests": [

            //
            [ "aB", true ],
            [ "aBbb", true ],
            [ "aBbbC", true ],

            [ "Aaa", false ],
            [ "aBB", false ],
            [ "aBBc", false ],
            [ "aBbbCC", false ],
        ],
    },

    "isPascalCase": {
        "method": "isPascalCase",
        "options": null,
        "tests": [

            //
            [ "AaaBBB", true ],

            [ "aaaBBB", false ],
        ],
    },

    "isStrictPascalCase": {
        "method": "isPascalCase",
        "options": { "strict": true },
        "tests": [

            //
            [ "A", true ],
            [ "AaBb", true ],
            [ "AaBbC", true ],

            [ "a", false ],
            [ "aaa", false ],
            [ "ABB", false ],
            [ "ABBc", false ],
            [ "ABbbCC", false ],
        ],
    },

    "toKebabCase": {
        "method": "toKebabCase",
        "options": { "allowProtected": true, "strict": false },
        "tests": [

            //
            [ "aaa", "aaa" ],
            [ "aa--a", "aa-a" ],
            [ "__aa--__a", "__aa-a" ],

            [ "AAA", "a-a-a" ],
            [ "Aaa", "aaa" ],
            [ "AaA", "aa-a" ],
            [ "AaaBbb", "aaa-bbb" ],
            [ "aaaBbb", "aaa-bbb" ],
            [ "AAABbb", "a-a-a-bbb" ],
            [ "AAABbbC", "a-a-a-bbb-c" ],
        ],
    },

    "toKebabCaseStrict": {
        "method": "toKebabCase",
        "options": { "allowProtected": true, "strict": true },
        "tests": [

            //
            [ "AAA", "aaa" ],
            [ "Aaa", "aaa" ],
            [ "AaA", "aa-a" ],
            [ "AaaBbb", "aaa-bbb" ],
            [ "aaaBbb", "aaa-bbb" ],
            [ "AAABbb", "aaa-bbb" ],
            [ "AAABbbC", "aaa-bbb-c" ],
        ],
    },
};

suite( "naming-conventions", () => {
    for ( const name in tests ) {
        for ( const _test of tests[ name ].tests ) {
            test( `${ name }_${ _test[ 0 ] }`, () => {
                strictEqual( namingConventions[ tests[ name ].method ]( _test[ 0 ], tests[ name ].options || {} ), _test[ 1 ] );
            } );
        }
    }
} );
