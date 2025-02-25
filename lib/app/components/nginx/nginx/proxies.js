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
    get ( id ) {
        return this.#proxies.get( id );
    }

    add ( proxies ) {
        const updated = this.#add( proxies );

        if ( updated ) this.#nginx.reload();

        return this;
    }

    delete ( proxies ) {
        const updated = this.#delete( proxies );

        if ( updated ) this.#nginx.reload();

        return this;
    }

    clear () {
        return this.delete( [ ...this.#proxies.keys() ] );
    }

    [ Symbol.iterator ] () {
        return this.#proxies.values();
    }

    // private
    #add ( proxies ) {
        if ( !proxies ) return;

        var updated;

        for ( const [ id, options ] of Object.entries( proxies ) ) {
            if ( !id ) continue;

            var proxy = this.#proxies.get( id );

            // proxy already exists
            if ( proxy ) continue;

            // upstream port is not valid
            if ( !this.#nginx.validatePort( options.upstreamPort ) ) continue;

            proxy = new NginxProxy( this.#nginx, id, options );

            this.#proxies.set( id, proxy );

            updated = true;
        }

        return updated;
    }

    #delete ( proxies ) {
        if ( !proxies ) return;

        var updated;

        for ( const id in proxies ) {
            const proxy = this.#proxies.get( id );

            if ( !proxy ) continue;

            this.#proxies.delete( id );

            proxy.delete();

            updated = true;
        }

        return updated;
    }
}
