const mixins = require( "#lib/mixins" );
const Upstream = require( "../upstream" );

const OptionsCountry = require( "../mixins/country" );

const DEFAULT_HOSTNAME = "proxy.packetstream.io";
const DEFAULT_PORT = 31112;

module.exports = class ProxyPacketstream extends mixins( OptionsCountry, Upstream ) {
    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname = DEFAULT_HOSTNAME;
        url.port = DEFAULT_PORT;

        if ( super.$init ) super.$init( url, options );
    }

    get isHttp () {
        return true;
    }

    _buildProxy ( cache ) {
        const proxy = super._buildProxy( cache );

        if ( cache.options.country ) proxy.password += "_country-" + cache.options.country;

        return proxy;
    }
};
