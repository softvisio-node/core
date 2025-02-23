import NginxProxyServerName from "./server-name.js";

export default class NginxProxyServerNames {
    #nginx;
    #serverNames = new Map();
    #defaultServerName;

    constructor ( nginx, serverNames ) {
        this.#nginx = nginx;
        this.#defaultServerName = new NginxProxyServerName( this );

        this.#add( serverNames );
    }

    // properties
    get app () {
        return this.#nginx.app;
    }

    get nginx () {
        return this.#nginx;
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

        if ( updated ) this.#nginx.reload();

        return this;
    }

    delete ( serverNames ) {
        const updated = this.#delete( serverNames );

        if ( updated ) this.#nginx.reload();

        return this;
    }

    // XXX sort ???
    [ Symbol.iterator ] () {
        if ( this.hasServerNames ) {
            return this.#serverNames.values();
        }
        else {
            return [ this.#defaultServerName ].values();
        }
    }

    // private
    #add ( serverNames ) {
        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        var updated;

        for ( let serverName of serverNames ) {
            serverName = serverName?.trim();

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
            serverName = serverName?.trim();

            serverName = this.#serverNames.get( serverName );

            if ( !serverName ) continue;

            this.#serverNames.delete( serverName.name );

            serverName.delete();

            updated = true;
        }

        return updated;
    }
}
