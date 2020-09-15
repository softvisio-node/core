const net = require( "net" );
const dns = require( "dns" );
const Lru = require( "lru-cache" );

const LRU = new Lru( {
    "max": 10000,
} );

module.exports.resolve4 = async function resolve4 ( hostname, noCache ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( !noCache ) {
        key = hostname + "/4";

        ip = LRU.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve4( hostname, { "ttl": true } );

            ip = res[0].address;

            if ( !noCache && res[0].ttl ) LRU.set( key, ip, res[0].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
};

module.exports.resolve6 = async function resolve4 ( hostname, noCache ) {
    if ( net.isIP( hostname ) ) return hostname;

    var key, ip;

    if ( !noCache ) {
        key = hostname + "/6";

        ip = LRU.get( key );
    }

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve6( hostname, { "ttl": true } );

            ip = res[0].address;

            if ( !noCache && res[0].ttl ) LRU.set( key, ip, res[0].ttl * 1000 );
        }
        catch ( e ) {}
    }

    return ip;
};
