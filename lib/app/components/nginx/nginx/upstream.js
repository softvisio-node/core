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

    get upstreams () {
        return this.#upstreams;
    }

    get hasUpstreams () {
        return !!this.#upstreams.size;
    }

    // public
    // XXX
    install () {}

    // XXX
    async reload () {}

    // XXX
    async delete () {}

    // XXX reload
    addServer ( port, options ) {
        const added = this.#addServer( port, options );

        if ( added ) this.reload();
    }

    // XXX reload
    deleteServer ( port ) {
        const deleted = this.#deleteServer( port );

        if ( deleted ) this.reload();
    }

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

    getSslServerNames ( port ) {
        const serverNames = new Set();

        for ( const server of this.#servers.values() ) {
            if ( server.port === port && server.sslEnabled ) {
                server.serverName.forEach( serverName => serverNames.add( serverName ) );
            }
        }

        return serverNames;
    }

    // private
    #addServer ( port, options ) {
        port = this.#validatePort();

        if ( !port ) return false;

        if ( this.#servers.has( port ) ) return false;

        const server = new NginxUpstreamServer( this, port, options );

        this.#servers.set( port, server );

        return true;
    }

    #deleteServer ( port ) {
        port = this.#validatePort();

        if ( !port ) return false;

        const server = this.#servers.get( port );

        if ( !server ) return false;

        this.#servers.delete( port );

        server.delete();

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
