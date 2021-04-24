const mixins = require( "#lib/mixins" );
const Rotating = require( "../rotating" );
const dns = require( "#lib/dns" );

const OptionsZone = require( "../mixins/zone" );
const OptionsCountry = require( "../mixins/country" );
const OptionsState = require( "../mixins/state" );
const OptionsCity = require( "../mixins/city" );
const OptionsResolveRemote = require( "../mixins/resolve-remote" );
const OptionsDirect = require( "../mixins/direct" );
const OptionsSession = require( "../mixins/session" );

// NOTE https://luminati.io/faq#examples

const DEFAULT_HOSTNAME = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

module.exports = class ProxyLuminati extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolveRemote, OptionsDirect, OptionsSession, Rotating ) {
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

    async _buildProxy ( options ) {
        const proxy = super._buildProxy( options );

        var username = "lum-customer-" + proxy.username;

        if ( options.zone ) username += "-zone-" + options.zone;
        if ( options.country ) username += "-country-" + options.country;
        if ( options.state ) username += "-state-" + options.state;
        if ( options.city ) username += "-city-" + options.city;
        if ( options.resolve === "remote" ) username += "-dns-local";
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

    _rotateNextProxy ( cache ) {
        cache.options.session = this._generateSession();

        return this._getUpstream( cache.options );
    }

    _rotateRandomProxy ( cache ) {
        cache.options.session = this._generateSession();

        return this._getUpstream( cache.options );
    }
};
