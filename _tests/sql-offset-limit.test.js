#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import sql from "#lib/sql";

const TESTS = [

    //
    { "params": [ null, null, { "maxResults": 0, "defaultLimit": 0, "maxLimit": 0 } ], "result": { "offset": 0, "limit": null } },
    { "params": [ 0, null, { "maxResults": 0, "defaultLimit": 0, "maxLimit": 0 } ], "result": { "offset": 0, "limit": null } },
    { "params": [ 0, 0, { "maxResults": 0, "defaultLimit": 0, "maxLimit": 0 } ], "result": { "offset": 0, "limit": 0 } },
    { "params": [ 0, 0, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 0, "limit": 0 } },
    { "params": [ 0, null, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 0, "limit": 10 } },
    { "params": [ 0, 70, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 0, "limit": 50 } },

    { "params": [ 100, null, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 100, "limit": 0 } },
    { "params": [ 99, null, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 99, "limit": 1 } },
    { "params": [ 1, 1000, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 50 } ], "result": { "offset": 1, "limit": 50 } },
    { "params": [ 1, 1000, { "maxResults": 100, "defaultLimit": 10, "maxLimit": 0 } ], "result": { "offset": 1, "limit": 99 } },
    { "params": [ 0, null, { "maxResults": 100, "defaultLimit": 0, "maxLimit": 0 } ], "result": { "offset": 0, "limit": 100 } },
];

suite( "sql", () => {
    suite( "offset-limit", () => {
        for ( let n = 0; n < TESTS.length; n++ ) _test( n );

        function _test ( id ) {
            const spec = TESTS[ id ];

            test( `${ id }`, () => {
                const res = sql.createOffsetLimit( ...spec.params );

                // console.log( JSON.stringify( res ) );

                strictEqual( res.offset, spec.result.offset );
                strictEqual( res.limit, spec.result.limit );
            } );
        }
    } );
} );
