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
    async _buildProxy ( bucket ) {
        const options = bucket.options;

        await this.#loadProxies( options.country );

        return this.#proxies[0];
    }

    async _buildNextProxy ( bucket, auto ) {
        await this.#loadProxies( bucket.options.country );

        if ( auto ) {
            bucket.autoIndex = this.#getNextIndex( bucket.autoIndex );

            return this.#proxies[bucket.autoIndex];
        }
        else {
            bucket.manualIndex = this.#getNextIndex( bucket.manualIndex );

            return this.#proxies[bucket.manualIndex];
        }
    }

    async _buildRandomProxy ( bucket, auto ) {
        await this.#loadProxies( bucket.options.country );

        return this.#proxies.getRandomValue();
    }

    // private
    #getNextIndex ( index ) {
        if ( index == null ) index = -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        return index;
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
        if ( proxies.length ) {
            const url = new URL( "http://host" );

            this.#proxies = proxies.map( proxy => this.constructor.new( url, proxy ) );
        }
    }
};
