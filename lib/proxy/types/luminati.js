import mixins from "#lib/mixins";
import Upstream from "../upstream.js";
import { resolve4 } from "#lib/dns";

import OptionsZone from "../mixins/zone.js";
import OptionsCountry from "../mixins/country.js";
import OptionsState from "../mixins/state.js";
import OptionsCity from "../mixins/city.js";
import OptionsDirect from "../mixins/direct.js";
import OptionsSession from "../mixins/session.js";
import OptionsRotating from "../mixins/rotating.js";

// NOTE https://luminati.io/faq#examples

const DEFAULT_HOSTNAME = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

export default class ProxyClientLuminati extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsDirect, OptionsSession, OptionsRotating, Upstream ) {

    // properties
    get isHttp () {
        return true;
    }

    get isHttps () {
        return true;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) bucket.setProxy( this._buildProxy( bucket ) );

        return bucket.getProxy();
    }

    async getNextProxy ( options ) {
        return this.getProxy( options );
    }

    async getRandomProxy ( options ) {
        return this.getProxy( options );
    }

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname = DEFAULT_HOSTNAME;
        url.port = DEFAULT_PORT;

        if ( super._init ) super._init( url, options );

        // drop session, if hostname is default
        if ( this.session && this.hostname === DEFAULT_HOSTNAME ) this.session = false;
    }

    async _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        const options = bucket.options;

        var username = "lum-customer-" + proxy.username;

        if ( options.zone ) username += "-zone-" + options.zone;
        if ( options.country ) username += "-country-" + options.country;
        if ( options.state ) username += "-state-" + options.state;
        if ( options.city ) username += "-city-" + options.city;
        if ( options.resolve ) username += "-dns-local";
        if ( options.direct ) username += "-direct";

        if ( options.session ) {
            proxy.hostname = await resolve4( options.country ? `servercountry-${ options.country }.${ DEFAULT_HOSTNAME }` : DEFAULT_HOSTNAME );

            username += "-session-" + options.session;
        }
        else {
            proxy.hostname = DEFAULT_HOSTNAME;
        }

        proxy.username = username;

        return proxy;
    }
}

ProxyClientLuminati.register( "luminati:", ProxyClientLuminati );
