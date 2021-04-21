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

// NOTE https://luminati.io/faq#examples

module.exports = class ProxyLuminati extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolve, OptionsDirect, OptionsSession, Rotating, Upstream, Proxy ) {
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

        // XXX
        if ( options.session ) username += ",session-" + options.session;

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
