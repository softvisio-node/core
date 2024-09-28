#!/usr/bin/env node

import { suite, test } from "node:test";
import { strictEqual } from "node:assert";

import Numeric from "#lib/numeric";

function generateRandomIntegers ( { min, max, num, crypto, threshold = 0.03 } ) {
    const avgWeight = Numeric( 1 ).divide( BigInt( max ) - BigInt( min ) + 1n ),
        stat = {};

    for ( let n = 0; n < num; n++ ) {
        const value = Numeric.randomInteger( {
            crypto,
            min,
            max,
        } );

        const key = value.toString();

        stat[ key ] ??= {
            "total": 0,
            "weight": 0,
            "deviation": 0,
        };

        stat[ key ].total++;
        stat[ key ].weight = stat[ key ].total / num;
        stat[ key ].deviation = avgWeight.subtract( stat[ key ].weight ).abs;
    }

    for ( const key of Object.keys( stat ).sort() ) {
        if ( stat[ key ].deviation.lt( threshold ) ) continue;

        throw new Error( `Random integers distribution deviation > ${ threshold }` );
    }
}

suite( "numeric", () => {
    suite( "precision", () => {
        const tests = [

            // precision
            {
                "constructor": [ "123", { "precision": 3 } ],
                "result": "123",
            },
            {
                "constructor": [ "123", { "precision": 2 } ],
                "result": null,
            },
            {
                "constructor": [ "123", { "precision": 4 } ],
                "result": "123",
            },
            {
                "constructor": [ "123.123", { "precision": 2 } ],
                "result": null,
            },
            {
                "constructor": [ "123.123", { "precision": 3 } ],
                "result": "123",
            },
            {
                "constructor": [ "123.123", { "precision": 4 } ],
                "result": "123.1",
            },
            {
                "constructor": [ "123.123", { "precision": 5 } ],
                "result": "123.12",
            },
            {
                "constructor": [ "123.199", { "precision": 5 } ],
                "result": "123.2",
            },
            {
                "constructor": [ "123.199", { "precision": 6 } ],
                "result": "123.199",
            },
            {
                "constructor": [ "123.999", { "precision": 4 } ],
                "result": "124",
            },
            {
                "constructor": [ "999.999", { "precision": 3 } ],
                "result": null,
            },
            {
                "constructor": [ "999.999", { "precision": 4 } ],
                "result": "1000",
            },

            // scale
            {
                "constructor": [ "123.123456", { "precision": 4, "scale": 1 } ],
                "result": "123.1",
            },
            {
                "constructor": [ "123.123456", { "precision": 4, "scale": 0 } ],
                "result": "123",
            },
            {
                "constructor": [ "123.123456", { "precision": 4, "scale": 2 } ],
                "result": null,
            },
        ];

        for ( let n = 0; n < tests.length; n++ ) {
            test( n + "", () => {
                try {
                    const numeric = Numeric( ...tests[ n ].constructor );

                    strictEqual( numeric.toString(), tests[ n ].result );
                }
                catch ( e ) {
                    if ( tests[ n ].result != null ) {
                        throw e;
                    }
                }
            } );
        }
    } );

    suite( "random-integers-distribution", () => {
        test( "1", () => {
            generateRandomIntegers( {
                "min": 0,
                "max": 7,
                "num": 10_000,
            } );
        } );

        test( "2", () => {
            generateRandomIntegers( {
                "min": -100_000_000,
                "max": 100_000_000,
                "num": 100_000,
            } );
        } );
    } );
} );
