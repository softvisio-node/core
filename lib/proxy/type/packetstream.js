import mixins from "#lib/mixins";
import Upstream from "../upstream.js";

import OptionsCountry from "../mixins/country.js";

const DEFAULT_HOSTNAME = "proxy.packetstream.io";
const DEFAULT_PORT = 31112;

export default class ProxyPacketstream extends mixins( OptionsCountry, Upstream ) {
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname = DEFAULT_HOSTNAME;
        url.port = DEFAULT_PORT;

        if ( super._init ) super._init( url, options );
    }

    get isHttp () {
        return true;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) {
            const proxy = this._buildProxy( bucket );

            bucket.setProxy( proxy );
        }

        return bucket.getProxy();
    }

    getNextProxy ( options ) {
        return this.getProxy( options );
    }

    getRandomProxy ( options ) {
        return this.getProxy( options );
    }

    // private
    _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        if ( bucket.options.country ) proxy.password += "_country-" + bucket.options.country;

        return proxy;
    }
}

ProxyPacketstream.register( "packetstream:", ProxyPacketstream );
