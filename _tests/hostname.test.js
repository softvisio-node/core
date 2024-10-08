#!/usr/bin/env node

import { strictEqual } from "node:assert";
import { suite, test } from "node:test";
import Hostname from "#lib/hostname";

const TESTS = [

    // ip
    { "hostname": "1.2.3.4", "isDomain": false, "isIp": true, "isIpV4": true, "isValid": true },
    { "hostname": "1.2.3.4.5", "isDomain": true, "isIp": false, "isIpV4": false, "isValid": false },

    // domain name validation
    { "hostname": "-a.1.2.3.4", "isDomain": true, "isValid": false },
    { "hostname": "a-a-a.1.2.3.4", "isDomain": true, "isValid": false },
    { "hostname": "a-a.1.2-.3.4", "isDomain": true, "isValid": false },

    // rules: ck, *.ck, !www.ck
    { "hostname": "www.ck", "publicSuffix": "ck", "rootDomain": "www.ck", "rootLabel": "www" },
    { "hostname": "a.www.ck", "publicSuffix": "ck", "rootDomain": "www.ck" },
    { "hostname": "a.b.c.ck", "publicSuffix": "c.ck", "rootDomain": "b.c.ck", "rootLabel": "b" },

    // rules: com.ua, ua
    { "hostname": "com.ua", "publicSuffix": "com.ua", "rootDomain": null, "isRootDomain": false, "isPublicSuffix": true },
    { "hostname": "zzz.com.ua", "publicSuffix": "com.ua", "rootDomain": "zzz.com.ua", "isRootDomain": true },
    { "hostname": "zzz.ua", "publicSuffix": "ua", "rootDomain": "zzz.ua", "rootLabel": "zzz" },

    // tld
    { "hostname": "zzz.ua", "tld": "ua", "isTld": false, "tldIsValid": true },
    { "hostname": "ua", "tld": "ua", "isTld": true, "tldIsValid": true },
    { "hostname": "zzz.fuck", "tld": "fuck", "isTld": false, "tldIsValid": false },
];

suite( "hostname", () => {
    for ( let n = 0; n < TESTS.length; n++ ) {
        const spec = TESTS[ n ];

        const hostname = new Hostname( spec.hostname );

        for ( const property in spec ) {
            if ( property === "hostname" ) continue;

            test( `${ n }-${ spec.hostname }-${ property }`, () => {
                const res = hostname[ property ];

                strictEqual( res instanceof Hostname
                    ? res.unicode
                    : res, spec[ property ] );
            } );
        }
    }
} );
