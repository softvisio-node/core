#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import GlobBraces from "#lib/glob/braces";

suite( "glob-braces", () => {
    const tests = {

        // incomplete escape
        "\\": "\\",
        "\\a\\": "\\a\\",
        "a\\": "a\\",
        "{\\": "{\\",
        "{a\\": "{a\\",

        // not a patterns
        "": "",
        "{}": "{}",
        "{,}": "",
        "{,,}": "",
        "{a}": "{a}",
        "}": "}",
        "a}": "a}",
        ",": ",",
        "a,a": "a,a",

        // incomplete patterns
        "{": "{",
        "{{": "{{",
        "{,": "{,",
        "{,,": "{,,",
        "{,{,,,": "{,{,,,",
        "{|": "{|",
        "{\\}": "{\\}",

        // partial complete patterns
        "{,{},,,": "{,{},,,",
        "{,{,,,},,,": "{,,,,",

        // groups
        "{a,b}": "@(a|b)",
        "{a|b,c}": "@(a|b|c)",
        "{a,b{c,d},{e,f}}": "@(a|b@(c|d)|@(e|f))",

        // string sequences
        "{a..z}": "[a-z]",
        "{z..a}": "[a-z]",
        "{a..g..2}": "[aceg]",
        "{0a..g..2}": "0[aceg]",
        "{0a..00g..2}": "00[aceg]",
    };

    for ( const [ pattern, res ] of Object.entries( tests ) ) {
        test( `"${ pattern }"`, () => {
            const globBraces = new GlobBraces( pattern );

            strictEqual( globBraces.expand(), res );
        } );
    }
} );
