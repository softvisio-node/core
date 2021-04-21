const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsZone = require( "../mixins/options/zone" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsState = require( "../mixins/options/state" );
const OptionsCity = require( "../mixins/options/city" );
const OptionsResolve = require( "../mixins/options/resolve" );
const OptionsSession = require( "../mixins/options/session" );

// const UpstreamRotating = require( "../mixins/upstream-rotating" );
const Upstream = require( "../mixins/upstream" );

module.exports = class ProxyStatic extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolve, OptionsSession, Upstream, Proxy ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    async _buildProxy ( options = {} ) {
        const proxy = super._buildProxy( options );

        var username = proxy.username;

        options = { ...this._options, ...( options || {} ) };

        if ( options.session === true || options.session === "true" ) options.session = this._generateSession();

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve ) username += ",resolve";
        if ( options.session ) username += ",session-" + options.session;

        proxy.username = username;

        return proxy;
    }
};
