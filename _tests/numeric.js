#!/usr/bin/env node

import { suite, test } from "node:test";

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
