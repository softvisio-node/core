const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsZone = require( "../mixins/options/zone" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsState = require( "../mixins/options/state" );
const OptionsCity = require( "../mixins/options/city" );
const OptionsResolve = require( "../mixins/options/resolve" );
const OptionsSession = require( "../mixins/options/session" );
const Upstream = require( "../mixins/upstream" );

module.exports = class ProxyStatic extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolve, OptionsSession, Upstream, Proxy ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    // XXX this and options
    async _buildUpstream ( options = {} ) {
        const proxy = await super._buildUpstream( options );

        var username = proxy.username;

        if ( this.zone ) username += ",zone-" + this.zone;
        if ( this.country ) username += ",country-" + this.country;
        if ( this.state ) username += ",state-" + this.state;
        if ( this.city ) username += ",city-" + this.city;
        if ( this.resolve ) username += ",resolve";
        if ( this.session ) username += ",session-" + this.session;

        proxy.username = username;

        return proxy;
    }
};
