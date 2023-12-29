import NginxUpstreamServer from "./upstream/server.js";
import net from "node:net";

export default class NginxUpstream {
    #nginx;
    #id;
    #port;
    #proxyProtocol;
    #upstreams = new Set();
    #servers = new Map();

    constructor ( nginx, name, port, { proxyProtocol } = {} ) {
        this.#nginx = nginx;
        this.#port = this.#validatePort( port );
        this.#id = `${name}-${this.#port}`;
        this.#proxyProtocol = !!proxyProtocol;
    }

    // properties
    get nginx () {
        return this.#nginx;
    }

    get id () {
        return this.#id;
    }

    get port () {
        return this.#port;
    }

    get proxyProtocol () {
        return this.#proxyProtocol;
    }

    get hasUpstreams () {
        return !!this.#upstreams.size;
    }

    // public
    async reload () {}

    // XXX
    async delete () {}

    async addUpstreams ( upstreams ) {
        const updated = this.#addUpstreams( upstreams );

        if ( updated ) {
            return this.reload();
        }
        else {
            return result( 200 );
        }
    }

    async deleteUpstreams ( upstreams ) {
        const updated = this.#deleteUpstreams( upstreams );

        if ( updated ) {
            return this.reload();
        }
        else {
            return result( 200 );
        }
    }

    // private
    #addServer ( port, options ) {
        port = this.#validatePort();

        if ( !port ) return;

        if ( this.#servers.has( port ) ) return;

        const server = new NginxUpstreamServer( this, port, options );

        this.#servers.set( port, server );

        return true;
    }

    #deleteServer ( port ) {
        port = this.#validatePort();

        if ( !port ) return;

        if ( !this.#servers.has( port ) ) return;

        this.#servers.delete( port );

        return true;
    }

    #addUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

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

    #deleteUpstreams ( upstreams ) {
        if ( !Array.isArray( upstreams ) ) upstreams = [upstreams];

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

    #validatePort ( port ) {
        if ( !port ) return;

        port = Number( port );

        if ( port < 1 || port > 65535 ) return;

        return port;
    }

    #validateUpstreamServer ( server ) {
        if ( !server ) return;

        // unix socket
        if ( server.startsWith( "unix:" ) ) {
            return server;
        }

        // ip address
        else {
            var [address, port] = server.split( ":" );

            const ip = net.isIP( address );

            if ( !ip ) return;

            port ||= this.#port;

            port = this.#validatePort( port );

            if ( !port ) return;

            return `${address}:${port}`;
        }
    }
}
