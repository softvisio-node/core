import mixins from "#lib/mixins";
import OptionsCountry from "../mixins/country.js";
import Upstream from "../upstream.js";

const DEFAULT_HOSTNAME = "proxy.packetstream.io";
const DEFAULT_PORT = 31_112;

export default class ProxyClientPacketstream extends mixins( OptionsCountry, Upstream ) {

    // properties
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

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname = DEFAULT_HOSTNAME;
        url.port = DEFAULT_PORT;

        if ( super._init ) super._init( url, options );
    }

    _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        if ( bucket.options.country ) proxy.password += "_country-" + bucket.options.country;

        return proxy;
    }
}

ProxyClientPacketstream.register( "packetstream:", ProxyClientPacketstream );
