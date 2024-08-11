import net from "node:net";
import dns from "node:dns";
import CacheLru from "#lib/cache/lru";

const CACHE = new CacheLru( {
    "maxSize": 10_000,
} );

export async function resolve4 ( hostname, { cache = true } = {} ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( cache ) {
        key = hostname + "/4";

        ip = CACHE.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve4( hostname, { "ttl": true } );

            ip = res[ 0 ].address;

            if ( cache && res[ 0 ].ttl ) CACHE.set( key, ip, res[ 0 ].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
}

export async function resolve6 ( hostname, { cache = true } = {} ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( cache ) {
        key = hostname + "/6";

        ip = CACHE.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve6( hostname, { "ttl": true } );

            ip = res[ 0 ].address;

            if ( cache && res[ 0 ].ttl ) CACHE.set( key, ip, res[ 0 ].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
}

export async function resolveMx ( hostname, { cache = true } = {} ) {
    const key = hostname + "/mx";

    var res;

    if ( cache ) {
        res = CACHE.get( key );
    }

    if ( !res ) {
        try {
            res = await dns.promises.resolveMx( hostname );

            if ( cache ) CACHE.set( key, res );
        }
        catch ( e ) {}
    }

    return res;
}
