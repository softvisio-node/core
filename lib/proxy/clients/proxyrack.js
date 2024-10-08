import mixins from "#lib/mixins";
import OptionsCity from "../mixins/city.js";
import OptionsCountry from "../mixins/country.js";
import Upstream from "../upstream.js";

const DEFAULT_HOSTNAME = "megaproxy.rotating.proxyrack.net";
const DEFAULT_PORT = 222;

export default class ProxyClientProxyrack extends mixins( OptionsCountry, OptionsCity, Upstream ) {

    // properties
    get isHttp () {
        return true;
    }

    get isSocks5 () {
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

        if ( bucket.options.country ) proxy.username += ";country=" + bucket.options.country;
        if ( bucket.options.city ) proxy.username += ";city=" + bucket.options.city;

        return proxy;
    }
}

ProxyClientProxyrack.register( "proxyrack:", ProxyClientProxyrack );
