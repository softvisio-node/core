import mixins from "#lib/mixins";
import Upstream from "../upstream.js";

import OptionsZone from "../mixins/zone.js";
import OptionsCountry from "../mixins/country.js";
import OptionsState from "../mixins/state.js";
import OptionsCity from "../mixins/city.js";
import OptionsSession from "../mixins/session.js";
import OptionsRotating from "../mixins/rotating.js";

export default class ProxyClientSoftvisio extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsSession, OptionsRotating, Upstream ) {
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

        var username = proxy.username.replaceAll( ",", "%2C" );

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve != null ) username += ",resolve-" + options.resolve;
        if ( options.session ) username += ",session-" + ( options.session + "" ).replaceAll( ",", "%2C" );

        if ( options.rotateRequests != null ) username += ",rotateRequests-" + options.rotateRequests;
        if ( options.rotateTimeout != null ) username += ",rotateTimeout-" + options.rotateTimeout;
        if ( options.rotateRandom != null ) username += ",rotateRandom-" + options.rotateRandom;

        proxy.username = username;

        return proxy;
    }
}

ProxyClientSoftvisio.register( "softvisio:", ProxyClientSoftvisio );
