#!/usr/bin/env node

import benchmark from "#lib/benchmark";

function test () {
    return 1;
}

const tests = {
    async sync () {
        return test();
    },

    async [ "await" ] () {
        return await test();
    },

    async promise () {
        return new Promise( resolve => {
            test();

            resolve();
        } );
    },
};

await benchmark( "Await speed test", tests, {
    "iterations": null,
    "seconds": 3,
    "threads": 1,
} );
