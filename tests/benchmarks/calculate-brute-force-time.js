#!/usr/bin/env node

import Numeric from "#lib/numeric";

const randomBytes = 16,
    iterationsPerSecond = Numeric( "1_000_000_000" ),
    secondsPerYear = 60 * 60 * 24 * 365;

const iterations = Numeric( 2, { "precision": 1000 } ).pow( 8 * randomBytes ),
    seconds = iterations.divide( iterationsPerSecond ),
    years = seconds.divide( secondsPerYear ).ceil().toString();

console.log( `${ years } years needed to brute-force ${ randomBytes } random bytes` );
