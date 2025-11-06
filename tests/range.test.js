#!/usr/bin/env node

import { deepStrictEqual } from "node:assert";
import { suite, test } from "node:test";
import Range from "#lib/range";

suite( "range", () => {
    suite( "calculate-readable-stream-range", () => {
        const tests = [
            {
                "start": null,
                "end": null,
                "length": null,
                "contentLength": null,
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
                "result": {
                    "start": 10,
                    "end": 19,
                    "length": undefined,
                },
            },
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( `${ n }`, () => {
                const range = new Range( {
                    "start": tests[ n ].start,
                    "end": tests[ n ].end,
                    "length": tests[ n ].length,
                } ).calculateReadStreamRange( tests[ n ].contentLength );

                deepStrictEqual( range, tests[ n ].result );
            } );
        }
    } );
} );
