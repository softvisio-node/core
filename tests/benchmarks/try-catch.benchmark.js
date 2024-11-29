#!/usr/bin/env node

import benchmark from "#lib/benchmark";

function test () {
    return 1;
}

const tests = {
    [ "no try / catch" ] () {
        test();
    },

    [ "try / catch" ] () {
        try {
            test();
        }
        catch {}
    },
};

await benchmark( "Try / catch speed test", tests, {
    "iterations": 100_000_000,
    "seconds": 3,
    "threads": 1,
} );
