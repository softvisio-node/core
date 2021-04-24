const mixins = require( "../../mixins" );
const OptionsZone = require( "../mixins/options/zone" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsState = require( "../mixins/options/state" );
const OptionsCity = require( "../mixins/options/city" );
const OptionsResolveRemote = require( "../mixins/options/resolve-remote" );
const OptionsSession = require( "../mixins/options/session" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../upstream" );

module.exports = class ProxySoftvisio extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolveRemote, OptionsSession, Rotating, Upstream ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    _buildProxy ( options ) {
        const proxy = super._buildProxy( options );

        var username = proxy.username;

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve === "remote" ) username += ",resolve-local";
        if ( options.session ) username += ",session-" + options.session;

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
