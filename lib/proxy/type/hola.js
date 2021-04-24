require( "#index" );

const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsSession = require( "../mixins/options/session" );
const Pool = require( "../mixins/pool" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../upstream" );
const hola = require( "#lib/api/hola" );
const Mutex = require( "#lib/threads/mutex" );

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes

module.exports = class ProxyHola extends mixins( OptionsCountry, OptionsSession, Pool, Rotating, Upstream ) {
    #mutex = new Mutex();
    #proxies = [];
    #lastUpdated = {};

    get isHttp () {
        return true;
    }

    // XXX add geo support
    async _buildProxy ( options = {} ) {
        await this.#loadProxies( options.country );

        if ( options.session ) return this.#proxies.getRandomValue();
        else return this.#proxies[0];
    }

    // XXX add geo support
    async _rotateNextProxy ( cache ) {
        await this.#loadProxies( cache.options.country );

        cache.index ??= -1;

        cache.index++;

        if ( cache.index >= this.#proxies.length ) cache.index = 0;

        return this.#proxies[cache.index];
    }

    // XXX add geo support
    // XXX exclude current proxy - cache.proxy
    async _rotateRandomProxy ( cache ) {
        await this.#loadProxies( cache.options.country );

        return this.#proxies.getRandomValue();
    }

    async #loadProxies ( country ) {
        if ( !country ) country = "";
        else country = country.toLowerCase();

        const lastUpdated = this.#lastUpdated[country];

        if ( !lastUpdated || new Date() - lastUpdated > UPDATE_INTERVAL ) {
            if ( !this.#mutex.tryDown() ) return await this.#mutex.signal.wait();

            const proxies = await hola.getProxies( country );

            this.#lastUpdated[country] = new Date();

            this.#setProxies( proxies );

            this.#mutex.up();
            this.#mutex.signal.broadcast();
        }
    }

    // XXX drop upstream cache???
    #setProxies ( proxies ) {
        if ( proxies.length ) this.#proxies = proxies.map( proxy => Proxy.new( proxy, { "resolve": this.resolve } ) );
    }
};
