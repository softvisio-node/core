#!/usr/bin/env node

import benchmark from "#lib/benchmark";
import "#lib/result";

const tests = {
    statusOnly () {
        return result( 200 );
    },

    statusText () {
        return result( [ 200, "Message" ] );
    },

    statusTextData () {
        return result( [ 200, "Message" ], { "a": 1 } );
    },

    statusTextDataProps () {
        return result( [ 200, "Message" ], { "a": 1 }, { "a": 1, "b": 2 } );
    },
};

await benchmark( "Result", tests, {
    "iterations": 1_000_000,
    "seconds": 2,
} );
