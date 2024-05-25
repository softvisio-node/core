import mixins from "#lib/mixins";
import Upstream from "../upstream.js";
import hola from "#lib/api/hola";
import Mutex from "#lib/threads/mutex";
import { getRandomArrayIndex } from "#lib/utils";

import OptionsCountry from "../mixins/country.js";
import OptionsSession from "../mixins/session.js";
import OptionsRotating from "../mixins/rotating.js";

const UPDATE_INTERVAL = 1000 * 60 * 10; // 10 minutes

export default class ProxyClientHola extends mixins( OptionsCountry, OptionsSession, OptionsRotating, Upstream ) {
    #mutex = new Mutex();
    #proxies = [];
    #lastUpdated = {};

    // properties
    get isHttp () {
        return true;
    }

    get isConnect () {
        return true;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) {
            await this.#loadProxies( bucket.options.country );

            if ( bucket.options.session ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }
        else if ( bucket.requireRotate() ) {
            await this.#loadProxies( bucket.options.country );

            if ( bucket.options.rotateRandom ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }

        return bucket.getProxy();
    }

    async getNextProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setNextProxy( bucket );

        return bucket.getProxy();
    }

    async getRandomProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setRandomProxy( bucket );

        return bucket.getProxy();
    }

    // private
    #setNextProxy ( bucket ) {
        var index = bucket.index ?? -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        bucket.index = index;

        return bucket.setProxy( this.#proxies[ index ] );
    }

    #setRandomProxy ( bucket ) {
        var index = getRandomArrayIndex( this.#proxies );

        bucket.index = index;

        return bucket.setProxy( this.#proxies[ index ] );
    }

    async #loadProxies ( country ) {
        if ( !country ) country = "";
        else country = country.toLowerCase();

        const lastUpdated = this.#lastUpdated[ country ];

        if ( !lastUpdated || new Date() - lastUpdated > UPDATE_INTERVAL ) {
            if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

            const proxies = await hola.getProxies( country );

            this.#lastUpdated[ country ] = new Date();

            this.#setProxies( country, proxies );

            this.#mutex.unlock();
        }
    }

    // XXX drop upstream cache???
    #setProxies ( country, proxies ) {
        if ( proxies.length ) {
            const url = new URL( "http://host" );

            this.#proxies = proxies.map( proxy => this.constructor.new( url, proxy ) );
        }
    }
}

ProxyClientHola.register( "hola:", ProxyClientHola );
