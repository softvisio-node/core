import "#index";

import mixins from "#lib/mixins";
import Upstream from "../upstream.js";
import ProxyClient from "#lib/proxy/proxy";

import OptionsCountry from "../mixins/country.js";
import OptionsResolveRemote from "../mixins/resolve-remote.js";
import OptionsSession from "../mixins/session.js";
import OptionsRotating from "../mixins/rotating.js";

export default class ProxyPool extends mixins( OptionsCountry, OptionsResolveRemote, OptionsSession, OptionsRotating, Upstream ) {
    #proxies = [];

    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        this.#addProxies( url.searchParams.getAll( "proxy" ) );

        if ( options.proxies ) this.#addProxies( options.proxies );
    }

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get url () {
        const url = super.url;

        if ( this.#proxies.length ) url.searchParams.set( "proxy", this.#proxies );

        return url;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) {
            if ( bucket.options.session ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }
        else if ( bucket.requireRotate() ) {
            if ( bucket.options.rotateRandom ) {
                this.#setRandomProxy( bucket );
            }
            else {
                this.#setNextProxy( bucket );
            }
        }

        var proxy = bucket.getProxy();

        if ( proxy ) proxy = await proxy.getProxy( bucket.options );

        return proxy;
    }

    async getNextProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setNextProxy( bucket );

        var proxy = bucket.getProxy();

        if ( proxy ) proxy = await proxy.getProxy( bucket.options );

        return proxy;
    }

    async getRandomProxy ( options ) {
        const bucket = this._getBucket( options );

        this.#setRandomProxy( bucket );

        var proxy = bucket.getProxy();

        if ( proxy ) proxy = await proxy.getProxy( bucket.options );

        return proxy;
    }

    // private
    #setNextProxy ( bucket ) {
        var index = bucket.index ?? -1;

        index++;

        if ( index >= this.#proxies.length ) index = 0;

        bucket.index = index;

        return bucket.setProxy( this.#proxies[index] );
    }

    #setRandomProxy ( bucket ) {
        var index = this.#proxies.getRandomKey();

        bucket.index = index;

        return bucket.setProxy( this.#proxies[index] );
    }

    #addProxies ( proxies ) {
        this.#proxies.push( ...proxies.map( proxy => ProxyClient.new( proxy ) ) );
    }
}

ProxyPool.register( "pool:", ProxyPool );
