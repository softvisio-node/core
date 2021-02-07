const mixins = require( "../../mixins" );
const ProxyPool = require( "./pool" );
const Hola = require( "./hola/api" );

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes
const hola = new Hola();

module.exports = class ProxyHola extends mixins( ProxyPool ) {
    get url () {
        const url = super.url;

        url.searchParams.delete( "proxy" );

        return url;
    }

    // ROTATE
    async getProxy ( options = {} ) {
        await this.#loadProxies();

        return super.getProxy( options );
    }

    async getRandomProxy ( options = {} ) {
        await this.#loadProxies();

        return super.getRandomProxy( options );
    }

    async rotateNextProxy ( options = {} ) {
        await this.#loadProxies();

        return super.rotateNextProxy( options );
    }

    async rotateRandomProxy ( options = {} ) {
        await this.#loadProxies();

        return super.rotateRandomProxy( options );
    }

    async #loadProxies () {
        if ( !hola.lastUpdated || new Date() - hola.lastUpdated > UPDATE_INTERVAL ) {
            const proxies = await hola.getProxies();

            if ( proxies ) this.setProxies( proxies );
        }
    }
};
