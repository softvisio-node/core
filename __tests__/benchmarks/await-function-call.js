#!/usr/bin/env node

import benchmark from "#lib/benchmark";

function test1 () {
    return 1;
}

async function test2 () {
    return 1;
}

const t = {
    async async () {
        for ( let n = 0; n < 10; n++ ) await test2();
    },
    sync () {
        for ( let n = 0; n < 10; n++ ) test1();
    },
};

await benchmark( t, {
    "iterations": 10000000,
} );
