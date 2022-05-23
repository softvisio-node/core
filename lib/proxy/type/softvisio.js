import mixins from "#lib/mixins";
import Upstream from "../upstream.js";

import OptionsZone from "../mixins/zone.js";
import OptionsCountry from "../mixins/country.js";
import OptionsState from "../mixins/state.js";
import OptionsCity from "../mixins/city.js";
import OptionsSession from "../mixins/session.js";
import OptionsRotating from "../mixins/rotating.js";

export default class ProxyClientSoftvisio extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsSession, OptionsRotating, Upstream ) {
    #isSecure = false;

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get isSecure () {
        return this.#isSecure;
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

        if ( super._init ) super._init( url, options );

        if ( this.protocol === "softvisio+tls:" ) {
            this.#isSecure = true;
        }
    }

    _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        const options = bucket.options;

        const username = new URLSearchParams();

        if ( proxy.username !== "" ) username.set( "username", proxy.username );

        if ( options.zone ) username.set( "zone", options.zone );
        if ( options.country ) username.set( "country", options.country );
        if ( options.state ) username.set( "state", options.state );
        if ( options.city ) username.set( "city", options.city );
        if ( options.resolve != null ) username.set( "resolve", options.resolve );
        if ( options.session ) username.set( "session", options.session );

        if ( options.rotateRequests != null ) username.set( "rotateRequests", options.rotateRequests );
        if ( options.rotateTimeout != null ) username.set( "rotateTimeout", options.rotateTimeout );
        if ( options.rotateRandom != null ) username.set( "rotateRandom", options.rotateRandom );

        proxy.username = username;

        return proxy;
    }
}

ProxyClientSoftvisio.register( "softvisio:", ProxyClientSoftvisio );
ProxyClientSoftvisio.register( "softvisio+tls:", ProxyClientSoftvisio );
