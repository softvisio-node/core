#!/usr/bin/env node

import { deepStrictEqual, fail } from "node:assert";
import { suite, test } from "node:test";
import Range from "#lib/range";

// XXX assert.fail
// XXX readFile - start, end

function createRange ( { start, end, length, contentLength, strict } = {} ) {
    return new Range( {
        start,
        end,
        length,
    } ).calculateReadStreamRange( contentLength, {
        strict,
    } );
}

suite( "range", () => {
    suite( "calculate-readable-stream-range", () => {
        const tests = [

            // no content length
            {
                "start": -1,
                "end": null,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": null,
            },
            {
                "start": null,
                "end": null,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 0,
                    "end": undefined,
                    "length": undefined,
                },
            },
            {
                "start": 10,
                "end": null,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": undefined,
                    "length": undefined,
                },
            },
            {
                "start": 10,
                "end": 10,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": -1,
                    "length": 0,
                },
            },
            {
                "start": 10,
                "end": 20,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": 19,
                    "length": undefined,
                },
            },

            // has content length
            {
                "start": null,
                "end": null,
                "length": null,
                "contentLength": 100,
                "strict": false,
                "result": {
                    "start": 0,
                    "end": 99,
                    "length": 100,
                },
            },
            {
                "start": 10,
                "end": null,
                "length": null,
                "contentLength": 100,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": 99,
                    "length": 90,
                },
            },
            {
                "start": 10,
                "end": 10,
                "length": null,
                "contentLength": 100,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": -1,
                    "length": 0,
                },
            },
            {
                "start": 10,
                "end": 20,
                "length": null,
                "contentLength": 100,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": 19,
                    "length": 10,
                },
            },
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( `${ n }`, () => {
                if ( tests[ n ].result ) {
                    const range = createRange( tests[ n ] );

                    deepStrictEqual( range, tests[ n ].result );
                }
                else {
                    fail( createRange( tests[ n ] ) );
                }
            } );
        }
    } );
} );
