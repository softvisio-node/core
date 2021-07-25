import net from "net";
import dns from "dns";
import CacheLRU from "@softvisio/utils/cache-lru";

const CACHE = new CacheLRU( {
    "max": 10000,
} );

export async function resolve4 ( hostname, noCache ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( !noCache ) {
        key = hostname + "/4";

        ip = CACHE.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve4( hostname, { "ttl": true } );

            ip = res[0].address;

            if ( !noCache && res[0].ttl ) CACHE.set( key, ip, res[0].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
}

export async function resolve6 ( hostname, noCache ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( !noCache ) {
        key = hostname + "/6";

        ip = CACHE.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve6( hostname, { "ttl": true } );

            ip = res[0].address;

            if ( !noCache && res[0].ttl ) CACHE.set( key, ip, res[0].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
}

export async function resolveMx ( hostname, noCache ) {
    const key = hostname + "/mx";

    var res;

    if ( !noCache ) {
        res = CACHE.get( key );
    }

    if ( !res ) {
        try {
            res = await dns.promises.resolveMx( hostname );

            if ( !noCache ) CACHE.set( key, res );
        }
        catch ( e ) {}
    }

    return res;
}
