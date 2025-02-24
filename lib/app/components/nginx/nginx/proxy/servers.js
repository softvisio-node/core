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
            if ( !this.#validatePort( server.port ) ) continue;

            server = new NginxProxyServer( this.#proxy, server );

            this.#servers.add( server );

            updated = true;
        }

        return updated;
    }

    #delete ( servers ) {
        if ( !Array.isArray( servers ) ) servers = [ servers ];

        var updated;

        for ( let server of servers ) {
            server = this.#servers.get( server );

            if ( !server ) continue;

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
