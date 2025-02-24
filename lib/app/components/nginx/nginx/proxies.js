import NginxProxy from "./proxy.js";

export default class NginxProxies {
    #nginx;
    #proxies = new Map();

    constructor ( nginx, proxies ) {
        this.#nginx = nginx;

        this.#add( proxies );
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get hasProxies () {
        return Boolean( this.#proxies.size );
    }

    // public
    get ( name, upstreamPort ) {
        const id = `${ name }-${ upstreamPort }`;

        return this.#proxies.get( id );
    }

    add ( name, upstreamPort, options ) {
        return this.#add( name, upstreamPort, options );
    }

    delete ( name, upstreamPort ) {
        this.#delete( name, upstreamPort );

        return this;
    }

    [ Symbol.iterator ] () {
        return this.#proxies.values();
    }

    // private
    #add ( name, upstreamPort, options ) {
        if ( !name ) return;

        const id = `${ name }-${ upstreamPort }`;

        var proxy = this.#proxies.get( id );

        if ( proxy ) return proxy;

        proxy = new NginxProxy( this.#nginx, name, upstreamPort, options );

        this.#proxies.set( id, proxy );

        // reload, if has upstreams
        if ( proxy.upstreams.hasUpstreams ) this.#nginx.reload();

        return proxy;
    }

    #delete ( name, upstreamPort ) {
        const id = `${ name }-${ upstreamPort }`;

        const proxy = this.#proxies.get( id );

        if ( !proxy ) return;

        this.#proxies.delete( id );

        proxy.delete();

        this.#nginx.reload();
    }
}
