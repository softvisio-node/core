require( "#index" );

const mixins = require( "#lib/mixins" );
const Pool = require( "../pool" );
const hola = require( "#lib/api/hola" );
const Mutex = require( "#lib/threads/mutex" );

const OptionsCountry = require( "../mixins/country" );
const OptionsSession = require( "../mixins/session" );

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes

module.exports = class ProxyHola extends mixins( OptionsCountry, OptionsSession, Pool ) {
    #mutex = new Mutex();
    #proxies = [];
    #lastUpdated = {};

    get isHttp () {
        return true;
    }

    // protected
    // XXX add geo support
    async _buildProxy ( cache ) {
        const options = cache.options;

        await this.#loadProxies( options.country );

        var proxy;

        if ( options.session ) proxy = this.#proxies.getRandomValue();
        else proxy = this.#proxies[0];

        return this.#buildProxy( cache, proxy );
    }

    // XXX add geo support
    async _buildNextProxy ( cache, auto ) {
        await this.#loadProxies( cache.options.country );

        if ( auto ) {
            cache.autoIndex = this.#getNextIndex( cache.autoIndex );

            return this.#buildProxy( cache, this.#proxies[cache.autoIndex] );
        }
        else {
            cache.manualIndex = this.#getNextIndex( cache.manualIndex );

            return this.#buildProxy( cache, this.#proxies[cache.manualIndex] );
        }
    }

    // XXX add geo support
    // XXX exclude current proxy - cache.proxy
    async _buildRandomProxy ( cache, auto ) {
        await this.#loadProxies( cache.options.country );

        return this.#buildProxy( cache, this.#proxies.getRandomValue() );
    }

    // private
    #getNextIndex ( index ) {
        if ( index == null ) index = -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        return index;
    }

    #buildProxy ( cache, proxy ) {
        const _proxy = super._buildProxy( cache );

        _proxy.hostname = proxy.hostname;
        _proxy.port = proxy.port;
        _proxy.username = proxy.username;
        _proxy.password = proxy.password;

        return _proxy;
    }

    async #loadProxies ( country ) {
        if ( !country ) country = "";
        else country = country.toLowerCase();

        const lastUpdated = this.#lastUpdated[country];

        if ( !lastUpdated || new Date() - lastUpdated > UPDATE_INTERVAL ) {
            if ( !this.#mutex.tryDown() ) return await this.#mutex.signal.wait();

            const proxies = await hola.getProxies( country );

            this.#lastUpdated[country] = new Date();

            this.#setProxies( country, proxies );

            this.#mutex.up();
            this.#mutex.signal.broadcast();
        }
    }

    // XXX drop upstream cache???
    #setProxies ( country, proxies ) {
        if ( proxies.length ) this.#proxies = proxies;
    }
};
