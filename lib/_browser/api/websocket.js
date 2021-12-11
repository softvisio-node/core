import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

const RECONNECT_INTERVAL = 1000 * 5; // 5 seconds, initial interval

export default class extends Http {
    #_url;
    #ref = true;

    #connectionsHostnames = new Set();
    #connections = new Set();
    #getConnectionSignal = new Signal();
    #connectSignal = new Signal();
    #reconnectTimeout;
    #reconnectInterval = 0;
    #connectMutex = new Mutex();

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

    get activeConnections () {
        return this.#connections.size;
    }

    get isConnected () {
        return !!this.#connections.size;
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
    _urlUpdated () {
        super._urlUpdated();

        this.#_url = null;

        // close connections if url was updated
        this.#disconnect();
    }

    _persistentUpdated () {
        if ( this.persistent ) {
            this._connectWebSocket();
        }
        else {

            // clear DNS re-check interval
            this.#clearReconnectTimeout();

            // close connections
            this.#disconnect();
        }
    }

    _tokenUpdated () {

        // close connections if token was updated
        this.#disconnect();
    }

    _maxConnectionsUpdated () {
        this._connectWebSocket();
    }

    _pongIntervalUpdated () {
        this.#startPong();
    }

    async _connectWebSocket () {
        if ( !this.persistent ) return;

        // max connections reached
        if ( this.maxConnections && this.activeConnections >= this.maxConnections ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        // set reconnect interval if not browser and interval is not set
        this.#setReconnectTimeout();

        try {
            const records = await this._lookup( this.#url.hostname );

            // unable to resolve hostname
            if ( !records ) throw `Unable to resolve dns`;

            for ( const record of records ) {

                // max connections reached
                if ( this.maxConnections && this.activeConnections >= this.maxConnections ) break;

                // connection to this address is already established
                if ( this.#connectionsHostnames.has( record.address ) ) continue;

                let url = this.#url,
                    hostname;

                if ( url.hostname !== record.address ) {
                    hostname = url.hostname;
                    url = new URL( url );
                    url.hostname = record.address;
                }

                const connection = new Connection( this, url, hostname, this.#ref );

                connection.once( "connect", this.#onConnect.bind( this, connection ) );
                connection.once( "disconnect", this.#onDisconnect.bind( this, connection ) );
                connection.on( "event", this.#onEvent.bind( this ) );

                this.#connectionsHostnames.add( connection.hostname );
                this.#connections.add( connection );
            }
        }
        catch ( e ) {
            this.#reconnectInterval = 0;
        }

        this.#getConnectionSignal.broadcast();

        this.#connectMutex.up();
    }

    // private
    async #getConnection () {
        while ( 1 ) {
            if ( !this.persistent ) return this;

            if ( this.isConnected ) {
                const connection = this.#connections.values().next().value;
                this.#connections.add( connection );

                return connection;
            }
            else {
                this._connectWebSocket();

                await this.#getConnectionSignal.wait();
            }
        }
    }

    // XXX
    #setReconnectTimeout () {
        if ( this.isBrowser ) return;

        this.#clearReconnectTimeout();

        if ( !this.#reconnectInterval ) this.#reconnectInterval = RECONNECT_INTERVAL;
        else this.#reconnectInterval *= 2;

        this.#reconnectTimeout = setTimeout( () => this._connectWebSocket(), this.#reconnectInterval ).unref();
    }

    // XXX
    #clearReconnectTimeout () {
        if ( !this.#reconnectTimeout ) return;

        clearTimeout( this.#reconnectTimeout );

        this.#reconnectTimeout = null;
    }

    #onConnect ( connection ) {
        if ( this.activeConnections === 1 ) {
            this.#connectSignal.broadcast();

            this.emit( "connect" );
        }
    }

    // XXX reconnect intervsl
    #onDisconnect ( connection, res ) {
        this.#connections.delete( connection );

        this.#connectionsHostnames.delete( connection.hostname );

        if ( !this.isConnected ) {
            this.emit( "disconnect", res );

            if ( res.status === 4000 ) this.emit( "signout" );
        }

        // reconnect
        this.#reconnectInterval = 0;
        this._connectWebSocket();
    }

    #onEvent ( name, args ) {
        this.emit( "event", name, args );

        this.emit( "event/" + name, ...args );
    }

    #disconnect () {
        this.#connections.forEach( connection => connection.disconnect() );
    }

    #startPong () {
        if ( !this.persistent ) return;

        this.#connections.forEach( connection => connection.startPong() );
    }
}
