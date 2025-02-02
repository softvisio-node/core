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
        "{a|b,c}": "@(a\\|b|c)",
    };

    for ( const [ pattern, res ] of Object.entries( tests ) ) {
        test( `"${ pattern }"`, () => {
            const globBraces = new GlobBraces( pattern );

            strictEqual( globBraces.expand(), res );
        } );
    }
} );
