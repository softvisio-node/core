const mixins = require( "#lib/mixins" );
const Upstream = require( "../upstream" );
const dns = require( "#lib/dns" );

const OptionsZone = require( "../mixins/zone" );
const OptionsCountry = require( "../mixins/country" );
const OptionsState = require( "../mixins/state" );
const OptionsCity = require( "../mixins/city" );
const OptionsResolveRemote = require( "../mixins/resolve-remote" );
const OptionsDirect = require( "../mixins/direct" );
const OptionsSession = require( "../mixins/session" );
const OptionsRotating = require( "../mixins/rotating" );

// NOTE https://luminati.io/faq#examples

const DEFAULT_HOSTNAME = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

module.exports = class ProxyLuminati extends mixins( OptionsZone, OptionsCountry, OptionsState, OptionsCity, OptionsResolveRemote, OptionsDirect, OptionsSession, OptionsRotating, Upstream ) {
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
    async _buildProxy ( bucket ) {
        const proxy = super._buildProxy( bucket );

        const options = bucket.options;

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
};
