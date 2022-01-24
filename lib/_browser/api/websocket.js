import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

export default class extends Http {
    #_url;
    #ref = true;

    #connectionsHostnames = new Set();
    #connections = new Set();
    #activeConnections = new Set();
    #eventsConnection;
    #connectMutex = new Mutex();
    #connectSignal = new Signal();

    get #url () {
        if ( !this.#_url ) {
            const url = new URL( this.protocol + "//" + this.hostname );

            url.port = this.port;
            url.pathname = this.pathname;

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            this.#_url = url;
        }

        return this.#_url;
    }

    get isConnected () {
        return !!this.#activeConnections.size;
    }

    // public
    async ping () {
        if ( !this.persistent ) return super.ping();

        const connection = await this.#getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.ping();
    }

    async healthcheck () {
        if ( !this.persistent ) return super.healthcheck();

        const connection = await this.#getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.healthcheck();
    }

    async publish ( name, ...args ) {
        if ( !this.persistent ) return super.publish( name, args );

        const connection = await this.#getConnection();

        if ( connection ) connection.publish( name, ...args );
    }

    async call ( method, ...args ) {
        if ( !this.persistent ) return super.call( method, args );

        const connection = await this.#getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.call( method, ...args );
    }

    callVoid ( method, ...args ) {
        if ( !this.persistent ) return super.callVoid( method, args );

        this.#getConnection().then( connection => connection?.callVoid( method, ...args ) );
    }

    async waitConnect () {
        if ( !this.persistent ) return;
        if ( this.isConnected ) return;

        return this.#connectSignal.wait();
    }

    ref () {
        if ( this.#ref ) return this;

        this.#ref = true;

        if ( !this.persistent ) return this;

        this.#connections.forEach( connection => connection.ref() );

        return this;
    }

    unref () {
        if ( !this.#ref ) return this;

        this.#ref = false;

        if ( !this.persistent ) return this;

        this.#connections.forEach( connection => connection.unref() );

        return this;
    }

    // protected
    _tokenUpdated () {

        // close connections if token was updated
        this.#disconnect();
    }

    async _connectWebSocket () {
        if ( !this.persistent ) return;

        // max connections always 1 under the browser
        const maxConnections = this.isBrowser ? 1 : this.maxConnections;

        // max connections limit reached
        if ( maxConnections && this.#connections.size >= maxConnections ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        var addresses = await this._lookup( { "silent": true } );

        // hostname not resolved
        if ( !addresses.size ) addresses = ["0.0.0.0"];

        for ( const address of addresses ) {

            // max connections limit reached
            if ( maxConnections && this.#connections.size >= maxConnections ) break;

            // connection to this address is already established
            if ( this.#connectionsHostnames.has( address ) ) continue;

            let url = this.#url;

            // connect to ip address
            if ( url.hostname !== address ) {
                url = new URL( url );
                url.hostname = address;
            }

            // create connection
            const connection = new Connection( this, url, this.hostname, this.#ref );

            // setup listeners
            connection.once( "connect", this.#onConnect.bind( this ) );
            connection.once( "disconnect", this.#onDisconnect.bind( this ) );
            connection.on( "event", this.#onEvent.bind( this ) );

            // register connection
            this.#connections.add( connection );
            this.#connectionsHostnames.add( connection.id );

            connection.connect();
        }

        this.#connectMutex.up();
        this.#connectMutex.signal.broadcast();
    }

    // private
    async #getConnection () {
        while ( 1 ) {
            if ( !this.persistent ) return this;

            if ( this.#connections.size ) {
                const connection = this.#connections.values().next().value;

                // rotate
                this.#connections.delete( connection );
                this.#connections.add( connection );

                return connection;
            }
            else {
                this._connectWebSocket();

                await this.#connectMutex.signal.wait();
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
        if ( !this.#eventsConnection ) {
            this.#eventsConnection = connection;
            this._setEventsConnection( connection );
        }
    }

    #onDisconnect ( connection, res ) {
        this.#connections.delete( connection );

        this.#connectionsHostnames.delete( connection.id );

        if ( this.#activeConnections.has( connection ) ) {
            this.#activeConnections.delete( connection );

            if ( !this.#activeConnections.size ) this._emit( "disconnect", [res] );

            if ( res.status === 4000 ) this._emit( "signout" );
        }

        // reset reconnect interval
        this._reset();

        // reconnect
        this._connectWebSocket();

        // events
        if ( connection === this.#eventsConnection ) {
            this.#eventsConnection = null;
            this._deleteEventsConnection();

            if ( this.#activeConnections.size ) {
                this.#eventsConnection = this.#connections.values().next().value;
                this._setEventsConnection( this.#eventsConnection );
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
