const net = require( "net" );
const dns = require( "dns" );
const Lru = require( "lru-cache" );

const CACHE_TIMEOUT = 1000 * 60;

const LRU = new Lru( {
    "max": 10000,
} );

module.exports.resolve4 = async function resolve4 ( hostname ) {
    if ( net.isIP( hostname ) ) return hostname;

    var ip = LRU.get( hostname );

    if ( !ip ) {
        try {
            const res = await dns.promises.resolve4( hostname );

            ip = res[0];

            LRU.set( hostname, ip, CACHE_TIMEOUT );
        }
        catch ( e ) {}
    }

    return ip;
};
