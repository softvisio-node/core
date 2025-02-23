import NginxProxyServerName from "./server-name.js";

export default class NginxProxyServerNames {
    #proxy;
    #serverNames = new Map();
    #defaultServerName;

    constructor ( proxy, serverNames ) {
        this.#proxy = proxy;

        this.#defaultServerName = new NginxProxyServerName( this.#proxy );

        this.add( serverNames );
    }

    // properties
    get proxy () {
        return this.#proxy;
    }

    get nginx () {
        return this.#proxy.nginx;
    }

    get hasServerNames () {
        return Boolean( this.#serverNames.size );
    }

    // public
    has ( serverName ) {
        return this.#serverNames.has( serverName );
    }

    get ( serverName ) {
        return this.#serverNames.get( serverName );
    }

    add ( serverNames ) {
        const updated = this.#add( serverNames );

        if ( updated ) this.nginx.reload();

        return this;
    }

    delete ( serverNames ) {
        const updated = this.#delete( serverNames );

        if ( updated ) this.nginx.reload();

        return this;
    }

    // XXX sort ???
    [ Symbol.iterator ] () {
        if ( this.hasServerNames ) {
            return this.#serverNames.values();
        }
        else {
            return [ this.#defaultServerName ];
        }
    }

    // private
    #add ( serverNames ) {
        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        var updated;

        for ( let serverName of serverNames ) {
            serverName = serverName.trim();

            if ( !serverName ) continue;

            if ( this.#serverNames.has( serverName ) ) continue;

            this.#serverNames.set( serverName, new NginxProxyServerName( this, serverName ) );

            updated = true;
        }

        return updated;
    }

    #delete ( serverNames ) {
        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        var updated;

        for ( let serverName of serverNames ) {
            serverName = serverName.trim();

            serverName = this.#serverNames.get( serverName );

            if ( !serverName ) continue;

            this.#serverNames.delete( serverName.name );

            serverName.delete();

            updated = true;
        }

        return updated;
    }
}
