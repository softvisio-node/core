#!/usr/bin/env node

import benchmark from "#lib/benchmark";

function test1 () {
    return 1;
}

async function test2 () {
    return 1;
}

const tests = {
    async asyncCall () {
        for ( let n = 0; n < 10; n++ ) await test2();
    },

    syncCall () {
        for ( let n = 0; n < 10; n++ ) test1();
    },
};

await benchmark( "Sync / async speed test", tests, {
    "iterations": 1_000_000,
    "time": 3,
} );
