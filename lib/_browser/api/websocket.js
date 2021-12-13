import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

const INITIAL_RECONNECT_INTERVAL = 1000 * 5; // 5 seconds, initial interval
const MAX_RECONNECT_INTERVAL = 60000; // 1 minute

export default class extends Http {
    #_url;
    #ref = true;

    #connectionsHostnames = new Set();
    #connections = new Set();
    #getConnectionSignal = new Signal();
    #connectSignal = new Signal();
    #reconnectTimeout;
    #reconnectInterval;
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

            // reset reconnect interval
            this.#reconnectInterval = null;

            this._connectWebSocket();
        }
        else {

            // remove reconnect timer
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

        // max connections always 1 under the browser
        const maxConnections = this.isBrowser ? 1 : this.maxConnections;

        // max connections limit reached
        if ( maxConnections && this.activeConnections >= maxConnections ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        // stop reconnect timer
        this.#clearReconnectTimeout();

        try {

            // NOTE promise is required to break connect / onClose / onDisconnect / connect loop under browser, when window is reloading
            const records = this.isBrowser ? await new Promise( resolve => resolve( [{ "address": this.hostname }] ) ) : await this._lookup( this.hostname );

            // unable to resolve hostname
            if ( !records ) throw `Unable to resolve hostname`;

            for ( const record of records ) {

                // max connections limit reached
                if ( maxConnections && this.activeConnections >= maxConnections ) break;

                // connection to this address is already established
                if ( this.#connectionsHostnames.has( record.address ) ) continue;

                let url = this.#url;

                // connect to ip address
                if ( url.hostname !== record.address ) {
                    url = new URL( url );
                    url.hostname = record.address;
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
        }
        catch ( e ) {

            // reset reconnect interval on error
            this.#reconnectInterval = null;
        }

        // set reconnect timer if limit of max connections is not reached
        if ( maxConnections && this.activeConnections < maxConnections ) this.#setReconnectTimeout();

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

    #setReconnectTimeout () {
        if ( !this.persistent || this.isBrowser ) return;

        this.#clearReconnectTimeout();

        if ( !this.#reconnectInterval ) this.#reconnectInterval = INITIAL_RECONNECT_INTERVAL;
        else this.#reconnectInterval *= 2;

        // limit reconnect interval
        if ( this.#reconnectInterval > MAX_RECONNECT_INTERVAL ) this.#reconnectInterval = MAX_RECONNECT_INTERVAL;

        this.#reconnectTimeout = setTimeout( this._connectWebSocket.bind( this ), this.#reconnectInterval );

        if ( this.#reconnectTimeout.unref ) this.#reconnectTimeout.unref();
    }

    #clearReconnectTimeout () {
        clearTimeout( this.#reconnectTimeout );
    }

    #onConnect ( connection ) {
        if ( this.activeConnections === 1 ) {
            this.#connectSignal.broadcast();

            this.emit( "connect" );
        }
    }

    #onDisconnect ( connection, res ) {
        this.#connections.delete( connection );

        this.#connectionsHostnames.delete( connection.id );

        if ( !this.isConnected ) {
            this.emit( "disconnect", res );

            if ( res.status === 4000 ) this.emit( "signout" );
        }

        // reset reconnect interval
        this.#reconnectInterval = null;

        // reconnect
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
