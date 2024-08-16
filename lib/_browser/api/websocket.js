import "#lib/result";
import Http from "./http.js";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";

export default class extends Http {
    #_url;
    #ref = true;

    #connectionsHostnames = new Set();
    #connections = new Set();
    #activeConnections = new Set();
    #connecting = 0;
    #connectSignal = new Signal();
    #newConnectionSignal = new Signal();
    #abortController = new AbortController();

    // properties
    get isConnected () {
        return !!this.#activeConnections.size;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    get hasRef () {
        return this.#ref;
    }

    // public
    // XXX mutex
    // XXX fake connection
    async connect () {
        if ( !this.isPersistent ) return;

        // max connections limit reached
        if ( this.realMaxConnections && this.#connections.size >= this.realMaxConnections ) return;

        this.#connecting++;

        // already connecting
        if ( this.#connecting > 1 ) return;

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
                if ( this.realMaxConnections && this.#connections.size >= this.realMaxConnections ) break;

                // connection to this address is already established
                if ( this.#connectionsHostnames.has( address ) ) continue;

                let url;

                if ( address ) {
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
                    this.#newConnectionSignal.broadcast( connection );
                }
            }

            if ( this.#connecting === 1 ) {
                this.#connecting = 0;

                break;
            }

            // has pending connect requests
            else {
                this.#connecting = 1;
            }
        }
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

        return this.#connectSignal.wait( { signal } );
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

    // XXX
    async #getConnection () {
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

                const connection = await this.#newConnectionSignal.wait();

                // fake connection
                if ( connection ) return connection;
            }
        }
    }

    #onConnect ( connection ) {
        this.#activeConnections.add( connection );

        if ( this.#activeConnections.size === 1 ) {
            this.#connectSignal.broadcast();

            this._emit( "connect" );
        }

        // events
        this._eventsConnection ||= connection;

        this.#newConnectionSignal.broadcast();
    }

    #onDisconnect ( connection, res ) {
        this.#connections.delete( connection );

        this.#connectionsHostnames.delete( connection.id );

        // was connected
        if ( this.#activeConnections.has( connection ) ) {
            this.#activeConnections.delete( connection );

            // didconnected
            if ( !this.#activeConnections.size ) {
                const abortController = this.#abortController;
                this.#abortController = new AbortController();
                abortController.abort();

                this._emit( "disconnect", [ res ] );
            }
        }

        // wasn't connected, disconnected after connect error
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

            if ( this.#activeConnections.size ) {
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
