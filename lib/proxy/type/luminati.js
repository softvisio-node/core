const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsZone = require( "../mixins/options/zone" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsState = require( "../mixins/options/state" );
const OptionsCity = require( "../mixins/options/city" );
const OptionsResolve = require( "../mixins/options/resolve" );
const OptionsDirect = require( "../mixins/options/direct" );
const OptionsSession = require( "../mixins/options/session" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../mixins/upstream" );
const dns = require( "../../dns" );

// NOTE https://luminati.io/faq#examples

const DEFAULT_HOSTNAME = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

module.exports = class ProxyLuminati extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolve, OptionsDirect, OptionsSession, Rotating, Upstream, Proxy ) {
    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname = DEFAULT_HOSTNAME;
        url.port = DEFAULT_PORT;

        if ( super.$init ) super.$init( url, options );

        // drop session, if hostname is default
        if ( this.session && this.hostname === DEFAULT_HOSTNAME ) this.session = false;
    }

    get isHttp () {
        return true;
    }

    // XXX
    async _buildProxy ( options = {} ) {
        const proxy = super._buildProxy( options );

        var username = "lum-customer-" + proxy.username;

        if ( options.zone ) username += "-zone-" + options.zone;
        if ( options.country ) username += "-country-" + options.country;
        if ( options.state ) username += "-state-" + options.state;
        if ( options.city ) username += "-city-" + options.city;
        if ( options.resolve ) username += "-dns-local";
        if ( options.direct ) username += "-direct";

        if ( options.session ) {
            proxy.hostname = await dns.resolve4( options.country ? `servercountry-${options.country}.${DEFAULT_HOSTNAME}` : DEFAULT_HOSTNAME );

            username += "-session-" + options.session;
        }
        else {
            proxy.hostname = DEFAULT_HOSTNAME;
        }

        proxy.username = username;

        return proxy;
    }

    async _rotateNextProxy ( options ) {
        options.session = true;

        return this._getUpstream( options );
    }

    async _rotateRandomProxy ( options ) {
        options.session = true;

        return this._getUpstream( options );
    }
};
