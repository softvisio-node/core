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

    // public
    set ( serverNames ) {
        const updated = this.#set( serverNames );

        if ( updated ) this.#nginx.reload();

        return this;
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

    clear () {
        return this.delete( [ ...this.#serverNames.keys() ] );
    }

    [ Symbol.iterator ] () {
        return this.#serverNames.values();
    }

    toJSON () {
        return [ ...this.#serverNames.keys() ];
    }

    // private
    #set ( serverNames ) {
        var updated = this.#add( serverNames );

        if ( !Array.isArray( serverNames ) ) serverNames = [ serverNames ];

        serverNames = new Set( serverNames );

        for ( const serverName of this.#serverNames.keys() ) {
            if ( !serverNames.has( serverName ) ) {

                // server name deleted
                if ( this.#delete( serverName ) ) updated = true;
            }
        }

        return updated;
    }

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
