import NginxProxyServer from "./server.js";

export default class NginxProxyServers {
    #proxy;
    #servers = new Set();

    constructor ( proxy, servers ) {
        this.#proxy = proxy;

        this.#add( servers );
    }

    // properties
    get proxy () {
        return this.#proxy;
    }

    get hasServers () {
        return Boolean( this.#servers.size );
    }

    // public
    add ( servers ) {
        const updated = this.#add( servers );

        if ( updated ) this.#proxy.nginx.reload();

        return this;
    }

    delete ( servers ) {
        const updated = this.#delete( servers );

        if ( updated ) this.#proxy.nginx.reload();

        return this;
    }

    clear () {
        return this.delete( [ ...this.#servers.values() ] );
    }

    [ Symbol.iterator ] () {
        return this.#servers.values();
    }

    // private
    #add ( servers ) {
        if ( !Array.isArray( servers ) ) servers = [ servers ];

        var updated;

        for ( let server of servers ) {
            if ( !server ) continue;

            const port = this.#validatePort( server.port );

            if ( !port ) continue;

            server = new NginxProxyServer( this.#proxy, port, server );

            this.#servers.add( server );

            updated = true;
        }

        return updated;
    }

    #delete ( servers ) {
        if ( !Array.isArray( servers ) ) servers = [ servers ];

        var updated;

        for ( const server of servers ) {
            if ( !this.#servers.has( server ) ) continue;

            this.#servers.delete( server );

            server.delete();

            updated = true;
        }

        return updated;
    }

    #validatePort ( port ) {
        if ( !port ) return;

        port = Number( port );

        if ( port < 1 || port > 65_535 ) return;

        return port;
    }
}
