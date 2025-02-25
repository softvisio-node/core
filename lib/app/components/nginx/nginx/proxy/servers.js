import NginxProxyServer from "./server.js";

export default class NginxProxyServers {
    #proxy;
    #servers = new Set();

    constructor ( proxy, servers ) {
        this.#proxy = proxy;

        this.#add( servers );
    }

    // properties
    get nginx () {
        return this.#proxy.nginx;
    }

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

            // server port is not valid
            if ( !this.nginx.validatePort( server.port ) ) continue;

            server = new NginxProxyServer( this.#proxy, server );

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
}
