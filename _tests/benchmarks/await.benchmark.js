#!/usr/bin/env node

import benchmark from "#lib/benchmark";

function test () {
    return 1;
}

const tests = {
    async sync () {
        return test();
    },

    async [ "async" ] () {
        return await test();
    },
};

await benchmark( "Await speed test", tests, {
    "iterations": null,
    "seconds": 3,
    "threads": 1,
} );
