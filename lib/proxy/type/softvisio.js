const mixins = require( "#lib/mixins" );
const Upstream = require( "../upstream" );

const OptionsZone = require( "../mixins/zone" );
const OptionsCountry = require( "../mixins/country" );
const OptionsState = require( "../mixins/state" );
const OptionsCity = require( "../mixins/city" );
const OptionsResolveRemote = require( "../mixins/resolve-remote" );
const OptionsSession = require( "../mixins/session" );
const OptionsRotating = require( "../mixins/rotating" );

module.exports = class ProxySoftvisio extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolveRemote, OptionsSession, OptionsRotating, Upstream ) {
    get isHttp () {
        return true;
    }

    get isSocks () {
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

    // private
    _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        const options = bucket.options;

        var username = proxy.username;

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve === "remote" ) username += ",resolve-local";
        if ( options.session ) username += ",session-" + options.session;

        username += ",rotate-" + !!options.rotate;
        username += ",rotateRandom-" + !!options.rotateRandom;
        if ( options.rotateTimeout != null ) username += ",rotateTimeout-" + options.rotateTimeout;
        username += ",rotateRequests-" + options.rotateRequests;

        proxy.username = username;

        return proxy;
    }
};
