const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsSession = require( "../mixins/options/session" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../mixins/upstream" );
const Hola = require( "./hola/api" );

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes
const hola = new Hola();

module.exports = class ProxyHola extends mixins( OptionsCountry, OptionsSession, Rotating, Upstream, Proxy ) {
    get isHttp () {
        return true;
    }

    async _buildProxy ( options = {} ) {
        const proxy = super._buildProxy( options );

        var username = proxy.username;

        if ( options.zone ) username += ",zone-" + options.zone;
        if ( options.country ) username += ",country-" + options.country;
        if ( options.state ) username += ",state-" + options.state;
        if ( options.city ) username += ",city-" + options.city;
        if ( options.resolve ) username += ",resolve";
        if ( options.session ) username += ",session-" + options.session;

        proxy.username = username;

        return proxy;
    }

    // XXX
    async _rotateNextProxy ( options ) {
        options.session = true;

        return this._getUpstream( options );
    }

    // XXX
    async _rotateRandomProxy ( options ) {
        options.session = true;

        return this._getUpstream( options );
    }

    // XXX
    async #loadProxies () {
        if ( !hola.lastUpdated || new Date() - hola.lastUpdated > UPDATE_INTERVAL ) {
            const proxies = await hola.getProxies();

            if ( proxies ) this.setProxies( proxies );
        }
    }
};
