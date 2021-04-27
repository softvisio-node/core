const mixins = require( "#lib/mixins" );
const Rotating = require( "../rotating" );

const OptionsZone = require( "../mixins/zone" );
const OptionsCountry = require( "../mixins/country" );
const OptionsState = require( "../mixins/state" );
const OptionsCity = require( "../mixins/city" );
const OptionsResolveRemote = require( "../mixins/resolve-remote" );
const OptionsSession = require( "../mixins/session" );

module.exports = class ProxySoftvisio extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolveRemote, OptionsSession, Rotating ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    _buildProxy ( bucket, session ) {
        const proxy = super._buildProxy( bucket );

        const options = bucket.options;

        var username = proxy.username;

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve === "remote" ) username += ",resolve-local";

        const _session = session || options.session;
        if ( _session ) username += ",session-" + _session;

        proxy.username = username;

        return proxy;
    }

    _buildNextProxy ( bucket, auto ) {
        return this._buildProxy( bucket, this._generateSession() );
    }

    _buildRandomProxy ( bucket, auto ) {
        return this._buildProxy( bucket, this._generateSession() );
    }
};
