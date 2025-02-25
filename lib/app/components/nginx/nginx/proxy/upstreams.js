import net from "node:net";

export default class NginxProxyUpstreams {
    #proxy;
    #upstreams = new Set();

    constructor ( proxy, upstreams ) {
        this.#proxy = proxy;

        this.#add( upstreams );
    }

    // properties
    get nginx () {
        return this.#proxy.nginx;
    }

    get proxy () {
        return this.#proxy;
    }

    get hasUpstreams () {
        return Boolean( this.#upstreams.size );
    }

    // public
    add ( upstreams ) {
        const updated = this.#add( upstreams );

        if ( updated ) this.#proxy.nginx.reload();

        return this;
    }

    delete ( upstreams ) {
        const updated = this.#delete( upstreams );

        if ( updated ) this.#proxy.nginx.reload();

        return this;
    }

    clear () {
        return this.delete( [ ...this.#upstreams.values() ] );
    }

    [ Symbol.iterator ] () {
        return this.#upstreams.values();
    }

    // private
    #add ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [ upstreams ];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#validateUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.add( upstream );

            updated = true;
        }

        return updated;
    }

    #delete ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [ upstreams ];

        var updated = false;

        for ( let upstream of upstreams ) {
            upstream = this.#validateUpstreamServer( upstream );

            if ( !upstream ) continue;

            if ( !this.#upstreams.has( upstream ) ) continue;

            this.#upstreams.delete( upstream );

            updated = true;
        }

        return updated;
    }

    #validateUpstreamServer ( server ) {
        if ( !server ) return;

        // unix socket
        if ( server.startsWith( "unix:" ) ) {
            return server;
        }

        // ip address
        else {
            var [ address, port ] = server.split( ":" );

            const ip = net.isIP( address );

            if ( !ip ) return;

            port ||= this.#proxy.upstreamPort;

            port = this.nginx.validatePort( port );

            if ( !port ) return;

            return `${ address }:${ port }`;
        }
    }
}
