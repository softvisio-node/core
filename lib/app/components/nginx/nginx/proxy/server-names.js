import NginxProxyServerName from "./server-name.js";

export default class NginxProxyServerNames {
    #nginx;
    #serverNames = new Map();

    constructor ( nginx, serverNames ) {
        this.#nginx = nginx;

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

    get defaultServerName () {
        return this.nginx.defaultServerName;
    }

    // public
    // XXX remove
    get ( serverName ) {
        if ( serverName === "" ) {
            return this.defaultServerName;
        }
        else {
            return this.#serverNames.get( serverName );
        }
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

    [ Symbol.iterator ] () {
        return this.#serverNames.values();
    }

    // private
    #add ( serverNames ) {
        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        var updated;

        for ( let serverName of serverNames ) {
            serverName = serverName?.trim();

            if ( !serverName ) continue;

            if ( this.#serverNames.has( serverName ) ) continue;

            this.#serverNames.set( serverName, new NginxProxyServerName( this.nginx, this, serverName ) );

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
