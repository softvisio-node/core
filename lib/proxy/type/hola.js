require( "@softvisio/core" );

const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const OptionsCountry = require( "../mixins/options/country" );
const OptionsSession = require( "../mixins/options/session" );
const Pool = require( "../mixins/pool" );
const Rotating = require( "../mixins/rotating" );
const Upstream = require( "../mixins/upstream" );
const Hola = require( "./hola/api" );
const Mutex = require( "#lib/threads/mutex" );

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes
const hola = new Hola();

module.exports = class ProxyHola extends mixins( OptionsCountry, OptionsSession, Pool, Rotating, Upstream, Proxy ) {
    #mutex = new Mutex();
    #proxies = [];

    get isHttp () {
        return true;
    }

    // XXX
    async getNextProxy ( options ) {}

    // XXX
    async getRandomProxy ( options ) {}

    async _buildProxy ( options = {} ) {
        await this.#loadProxies();

        return this.#proxies[0];
    }

    // XXX
    async _rotateNextProxy ( cache ) {
        await this.#loadProxies();

        const proxy = this.#proxies.shift();

        if ( proxy ) this.#proxies.push( proxy );

        return proxy;
    }

    // XXX
    async _rotateRandomProxy ( cache ) {
        await this.#loadProxies();

        return this.#proxies.getRandomValue();
    }

    async #loadProxies () {
        if ( !hola.lastUpdated || new Date() - hola.lastUpdated > UPDATE_INTERVAL ) {
            if ( !this.#mutex.tryDown() ) return await this.#mutex.signal.wait();

            const proxies = await hola.getProxies();

            this.#setProxies( proxies );

            this.#mutex.up();
            this.#mutex.signal.broadcast();
        }
    }

    // XXX drop upstream cache???
    #setProxies ( proxies ) {
        if ( proxies ) this.#proxies = proxies;
    }
};
