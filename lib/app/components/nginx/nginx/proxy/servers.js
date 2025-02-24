import NginxProxyServer from "./server.js";

export default class NginxProxyServers {
    #proxy;
    #servers = new Map();

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

    delete ( ports ) {
        const updated = this.#delete( ports );

        if ( updated ) this.#proxy.nginx.reload();

        return this;
    }

    clear () {
        return this.delete( [ ...this.#servers.keys() ] );
    }

    [ Symbol.iterator ] () {
        return this.#servers.values();
    }

    // private
    #add ( servers ) {
        var updated;

        if ( servers ) {
            for ( let port of Object.keys( servers ) ) {
                port = this.#validatePort( port );

                if ( !port ) continue;

                const server = new NginxProxyServer( this.#proxy, port, servers[ port ] );

                this.#servers.set( port, server );

                updated = true;
            }
        }

        return updated;
    }

    #delete ( ports ) {
        if ( !Array.isArray( ports ) ) ports = [ ports ];

        var updated;

        for ( let port of ports ) {
            port = this.#validatePort( port );

            if ( !port ) continue;

            const server = this.#servers.get( port );

            if ( !server ) continue;

            this.#servers.delete( port );

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
