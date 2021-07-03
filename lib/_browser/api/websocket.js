import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

const CONNECT_INTERVAL = 1000 * 60; // 60 seconds

export default class extends Http {
    #_url;

    #connectionsHostnames = new Set();
    #connections = [];
    #getConnectionSignal = new Signal();
    #connectSignal = new Signal();
    #connectClearInterval;
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
        return this.#connections.length;
    }

    get isConnected () {
        return !!this.#connections.length;
    }

    // public
    async getConnection () {
        while ( 1 ) {
            if ( !this.persistent ) return this;

            if ( this.isConnected ) {
                const connection = this.#connections.shift();
                this.#connections.push( connection );

                return connection;
            }
            else {
                this._connectWebSocket();

                await this.#getConnectionSignal.wait();
            }
        }
    }

    async ping () {
        if ( !this.persistent ) return super.ping();

        const connection = await this.getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.ping();
    }

    async healthcheck () {
        if ( !this.persistent ) return super.healthcheck();

        const connection = await this.getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.healthcheck();
    }

    async publish ( name, ...args ) {
        if ( !this.persistent ) return super.publish( name, args );

        const connection = await this.getConnection();

        if ( connection ) connection.publish( name, ...args );
    }

    async call ( method, ...args ) {
        if ( !this.persistent ) return super.call( method, args );

        const connection = await this.getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.call( method, ...args );
    }

    callVoid ( method, ...args ) {
        if ( !this.persistent ) return super.callVoid( method, args );

        this.getConnection().then( connection => connection?.callVoid( method, ...args ) );
    }

    async waitConnect () {
        if ( !this.persistent ) return;
        if ( this.isConnected ) return;

        return this.#connectSignal.wait();
    }

    // protected
    // XXX
    _urlUpdated () {
        super._urlUpdated();

        this.#url = null;

        // close connection if url was updated
        this.#disconnect();

        // persistent
        if ( this.persistent ) this._connectWebSocket();
        else {
            if ( this.#connectClearInterval ) {
                clearInterval( this.#connectClearInterval );

                this.#connectClearInterval = null;
            }

            this.#disconnect();
        }
    }

    // XXX
    _maxConnectionsUpdated () {
        if ( !this.persistent ) return;

        this._connectWebSocket();
    }

    // XXX
    _pongIntervalUpdated () {
        if ( !this.persistent ) return;

        this.#startPong();
    }

    // XXX
    async _connectWebSocket () {
        if ( !this.persistent ) return;

        // set reconnect interval if not browser and interval is not set
        if ( !this.isBrowser && !this.#connectClearInterval ) this.#connectClearInterval = setInterval( () => this._connectWebSocket(), CONNECT_INTERVAL );

        // max connections reached
        if ( this.maxConnections && this.activeConnections >= this.maxConnections ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        try {
            const records = await this._lookup( this.#url.hostname );

            // unable to resolve hostname
            if ( !records ) throw Error;

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

                const connection = new Connection( this, url, hostname );

                connection.once( "connect", this.#onConnect.bind( this, connection ) );
                connection.once( "disconnect", this.#onDisconnect.bind( this, connection ) );
                connection.on( "event", this.#onEvent.bind( this ) );

                this.#connectionsHostnames.add( connection.hostname );
                this.#connections.unshift( connection );
            }
        }
        catch ( e ) {}

        this.#getConnectionSignal.broadcast();

        this.#connectMutex.up();
    }

    // private
    #onConnect ( connection ) {
        if ( this.activeConnections === 1 ) {
            this.#connectSignal.broadcast();

            this.emit( "connect" );
        }
    }

    #onDisconnect ( connection, res ) {
        this.#connectionsHostnames.delete( connection.hostname );

        for ( let n = 0; n < this.#connections.length; n++ ) {
            if ( this.#connections[n] === connection ) {
                this.#connections.splice( n, 1 );

                break;
            }
        }

        if ( !this.isConnected ) {
            this.emit( "disconnect", res );

            if ( res.status === 1100 ) this.emit( "signout" );
        }

        // reconnect
        this._connectWebSocket();
    }

    #onEvent ( name, args ) {
        this.emit( "event", name, args );
        this.emit( "event/" + name, ...args );
    }

    #disconnect () {
        for ( const connection of this.#connections ) connection.disconnect();
    }

    #startPong () {
        if ( !this.persistent ) return;

        for ( const connection of this.#connections ) connection.startPong();
    }
}
