#!/usr/bin/env node

import { deepStrictEqual, throws } from "node:assert";
import { suite, test } from "node:test";
import Range from "#lib/range";

function createRange ( method, { start, end, length, contentLength, strict } = {} ) {
    return new Range( {
        start,
        end,
        length,
    } )[ method ]( contentLength, {
        strict,
    } );
}

function runTest ( method, test ) {
    if ( test.result ) {
        const range = createRange( method, test );

        deepStrictEqual( range, test.result );
    }
    else {
        throws( () => createRange( method, test ) );
    }
}

suite( "range", () => {
    suite( "calculate-range", () => {
        const tests = [
            {
                "start": 0,
                "end": 0,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 0,
                    "end": 0,
                    "length": 0,
                    "maxEnd": 0,
                    "maxLength": 0,
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
                    "end": undefined,
                    "length": 0,
                    "maxEnd": 10,
                    "maxLength": 0,
                },
            },
            {
                "start": 10,
                "end": 100,
                "length": null,
                "contentLength": null,
                "strict": false,
                "result": {
                    "start": 10,
                    "end": undefined,
                    "length": undefined,
                    "maxEnd": 100,
                    "maxLength": 90,
                },
            },
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( `${ n }`, () => {
                runTest( "calculateRange", tests[ n ] );
            } );
        }
    } );

    suite( "calculate-read-stream-range", () => {
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
                runTest( "calculateReadStreamRange", tests[ n ] );
            } );
        }
    } );
} );
