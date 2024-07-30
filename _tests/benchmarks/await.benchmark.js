#!/usr/bin/env node

import benchmark from "#lib/benchmark";

const tests = {
    async [ "async" ] () {
        return 1;
    },

    sync () {
        return 1;
    },
};

await benchmark( "Await speed test", tests, {
    "iterations": null,
    "seconds": 3,
    "threads": 1,
} );
