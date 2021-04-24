const mixins = require( "../../mixins" );
const OptionsCountry = require( "../mixins/options/country" );
const Upstream = require( "../upstream" );

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

    _buildProxy ( options = {} ) {
        const proxy = super._buildProxy( options );

        if ( options.country ) proxy.password += "_country-" + options.country;

        return proxy;
    }
};
