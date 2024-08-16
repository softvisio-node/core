import "#lib/result";
import Http from "./http.js";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";

const RECONNECT_TIMEOUT = 500;

export default class extends Http {
    #_url;
    #ref = true;

    #connectRequests = 0;
    #connectionsHostnames = new Set();
    #connections = new Set();
    #openedConnections = new Set();
    #newConnectionSignal = new Signal();
    #openedConnectionSignal = new Signal();
    #abortController = new AbortController();

    // properties
    get isConnected () {
        return !!this.#openedConnections.size;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    get hasRef () {
        return this.#ref;
    }

    // public
    async connect () {
        if ( !this.isPersistent ) return;

        // max connections limit reached
        if ( this.#connections.size >= this.realMaxConnections ) return;

        this.#connectRequests++;

        // already connecting
        if ( this.#connectRequests > 1 ) return;

        while ( true ) {
            let addresses;

            if ( this.realMaxConnections === 1 ) {
                addresses = new Set( [ this.hostname ] );
            }
            else {
                addresses = await this._dnsLookup();
            }

            // hostname not resolved
            if ( !addresses.size ) {
                addresses = [ null ];
            }

            for ( const address of addresses ) {

                // max connections limit reached
                if ( this.#connections.size >= this.realMaxConnections ) break;

                let url;

                if ( address ) {

                    // connection to this address is already established
                    if ( this.#connectionsHostnames.has( address ) ) continue;

                    url = this.#url;

                    // connect to ip address
                    if ( url.hostname !== address ) {
                        url = new URL( url );
                        url.hostname = address;
                    }
                }

                // create connection
                const connection = new Connection( this, url );

                // real connection
                if ( connection.id ) {

                    // setup listeners
                    connection.once( "connect", this.#onConnect.bind( this ) );
                    connection.once( "disconnect", this.#onDisconnect.bind( this ) );

                    connection.on( "event", this.#onEvent.bind( this ) );
                    connection.on( "sessionDisable", () => this._emit( "sessionDisable" ) );
                    connection.on( "sessionDelete", () => this._emit( "sessionDelete" ) );
                    connection.on( "sessionReload", () => this._emit( "sessionReload" ) );
                    connection.on( "accessDenied", () => this._emit( "accessDenied" ) );

                    // register connection
                    this.#connections.add( connection );
                    this.#connectionsHostnames.add( connection.id );

                    connection.connect();
                }

                // fake connection
                else {
                    this.#connectRequests++;

                    this.#newConnectionSignal.broadcast( connection );
                }
            }

            if ( this.#connectRequests === 1 ) {
                break;
            }

            // has pending connect requests
            else {
                this.#connectRequests = 1;
            }

            await new Promise( resolve => {
                const timeout = setTimeout( resolve, RECONNECT_TIMEOUT );

                if ( !this.#ref ) timeout.unref();
            } );
        }

        this.#connectRequests = 0;
    }

    async lock ( callback, { signal } = {} ) {
        const connection = await this.#getOpenedConnection( signal );

        callback( connection );
    }

    async publish ( name, ...args ) {
        if ( !this.isPersistent ) return super.publish( name, args );

        this.#getConnection().then( connection => connection.publish( name, ...args ) );
    }

    async call ( method, ...args ) {
        if ( !this.isPersistent ) return super.call( method, args );

        const connection = await this.#getConnection();

        const res = await connection.call( method, ...args );

        // authorization
        if ( res.status === -32812 ) {
            if ( this.onAuthorization && ( await this.onAuthorization() ) ) {

                // repeat request
                return this.call( method, ...args );
            }
        }

        return res;
    }

    voidCall ( method, ...args ) {
        if ( !this.isPersistent ) return super.voidCall( method, args );

        this.#getConnection().then( connection => connection.voidCall( method, ...args ) );
    }

    async waitConnect ( signal ) {
        if ( !this.isPersistent ) return;

        if ( this.isConnected ) return;

        return this.#openedConnectionSignal.wait( { signal } );
    }

    ref () {
        if ( this.#ref ) return this;

        this.#ref = true;

        if ( !this.isPersistent ) return this;

        this.#connections.forEach( connection => connection.ref() );

        return this;
    }

    unref () {
        if ( !this.#ref ) return this;

        this.#ref = false;

        if ( !this.isPersistent ) return this;

        this.#connections.forEach( connection => connection.unref() );

        return this;
    }

    // protected
    _tokenUpdated () {

        // close connections if token was updated
        this.#disconnect();
    }

    // private
    get #url () {
        if ( !this.#_url ) {
            const url = new URL( this.protocol + "//" + this.hostname );

            url.port = this.port;
            url.pathname = this.pathname;

            if ( url.protocol === "http:" ) {
                url.protocol = "ws:";
            }
            else if ( url.protocol === "https:" ) {
                url.protocol = "wss:";
            }

            // add locale
            if ( this.locale ) {
                url.searchParams.set( "locale", this.locale );
            }

            this.#_url = url;
        }

        return this.#_url;
    }

    async #getConnection ( signal ) {
        while ( true ) {
            if ( this.#connections.size ) {
                const connection = this.#connections.values().next().value;

                // rotate
                this.#connections.delete( connection );
                this.#connections.add( connection );

                return connection;
            }
            else {
                this.connect();

                const fakeConnection = await this.#newConnectionSignal.wait( { signal } );

                // fake connection
                if ( fakeConnection ) {
                    return fakeConnection;
                }
            }
        }
    }

    async #getOpenedConnection ( signal ) {
        while ( true ) {
            if ( this.#openedConnections.size ) {
                const connection = this.#openedConnections.values().next().value;

                // rotate
                this.#openedConnections.delete( connection );
                this.#openedConnections.add( connection );

                return connection;
            }
            else {
                this.connect();

                await this.#openedConnectionSignal.wait( { signal } );
            }
        }
    }

    #onConnect ( connection ) {
        this.#openedConnections.add( connection );

        // events
        this._eventsConnection ||= connection;

        // connected
        if ( this.#openedConnections.size === 1 ) {
            this._emit( "connect" );
        }

        this.#openedConnectionSignal.broadcast();
    }

    #onDisconnect ( connection, res ) {
        this.#connections.delete( connection );

        this.#connectionsHostnames.delete( connection.id );

        // was opened
        if ( this.#openedConnections.has( connection ) ) {
            this.#openedConnections.delete( connection );

            // didconnected
            if ( !this.#openedConnections.size ) {
                const abortController = this.#abortController;
                this.#abortController = new AbortController();
                abortController.abort();

                this._emit( "disconnect", [ res ] );
            }
        }

        // wasn't opened, disconnected after connect error
        else {
            this.#newConnectionSignal.broadcast( connection );
        }

        // reset reconnect interval
        if ( this.realMaxConnections !== 1 ) {
            this._dnsReset();
        }

        // reconnect
        this.connect();

        // events
        if ( connection === this._eventsConnection ) {
            this._eventsConnection = null;

            if ( this.#openedConnections.size ) {
                this._eventsConnection = this.#connections.values().next().value;
            }
        }
    }

    #onEvent ( name, args ) {
        this._emitRemote( name, args );
    }

    #disconnect () {
        this.#connections.forEach( connection => connection.disconnect() );
    }
}
