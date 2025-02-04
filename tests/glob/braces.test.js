#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import GlobBraces from "#lib/glob/braces";

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

    // invalid sequences
    "{a..1}": "{a..1}",
    "{a..ф}": "{a..ф}",

    // char sequences
    "{a..z}": "[a-z]",
    "{z..a}": "[a-z]",
    "{a..g..2}": "[aceg]",
    "{0a..g..2}": "0[aceg]",
    "{0a..00g..2}": "00[aceg]",
    "{a..b..100}": "a",
    "{a..000b..100}": "000a",

    // numeric sequences
    "{1..10..2}": "@(1|3|5|7|9)",
};

suite( "glob-braces", () => {
    for ( const [ pattern, res ] of Object.entries( tests ) ) {
        test( `"${ pattern }"`, () => {
            const globBraces = new GlobBraces( pattern );

            strictEqual( globBraces.expand(), res );
        } );
    }
} );
