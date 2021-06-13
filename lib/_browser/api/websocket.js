import Http from "./http.js";
import result from "#lib/result";
import Connection from "./websocket/connection.js";
import Signal from "#lib/threads/signal";
import Mutex from "#lib/threads/mutex";

const CONNECT_INTERVAL = 1000 * 60; // 60 seconds

export default class extends Http {
    #websocketUrl;
    #onRPC; // async function( method, params )

    #connectionsHostnames = new Set();
    #connections = [];
    #getConnectionSignal = new Signal();
    #connectClearInterval;
    #connectMutex = new Mutex();

    constructor ( options ) {
        super( options );

        this.#onRPC = options.onRPC;
    }

    get websocketUrl () {
        if ( !this.#websocketUrl ) {
            const url = new URL( this.url );

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            url.username = "";
            url.password = "";
            url.search = "";
            url.hash = "";

            this.#websocketUrl = url;
        }

        return this.#websocketUrl;
    }

    set url ( value ) {
        super.url = null;

        this.#websocketUrl = null;

        // close connection if url was updated
        this.#close();
    }

    set token ( value ) {

        // close connection if token was updated
        this.#close();
    }

    set persistent ( value ) {
        if ( this.persistent ) this._connectWebSocket();
        else {
            if ( this.#connectClearInterval ) {
                clearInterval( this.#connectClearInterval );

                this.#connectClearInterval = null;
            }

            this.#close();
        }
    }

    set pongInterval ( value ) {
        this.#startPong();
    }

    set maxConnections ( value ) {
        this._connectWebSocket();
    }

    get onRPC () {
        return this.#onRPC;
    }

    get activeConnections () {
        return this.#connections.length;
    }

    // public
    async getConnection () {
        while ( 1 ) {
            if ( !this.persistent ) return;

            if ( this.activeConnections ) {
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

    async call ( method, ...params ) {
        if ( !this.persistent ) return super._callHTTP( method, params );

        const connection = await this.getConnection();

        if ( !connection ) return result( [500, `Unable to create connection`] );

        return connection.call( method, ...params );
    }

    callVoid ( method, ...params ) {
        if ( !this.persistent ) {
            super._callVoidHTTP( method, params );
        }
        else {
            this.getConnection().then( connection => connection?.callVoid( method, ...params ) );
        }
    }

    publish ( name, ...params ) {
        if ( !this.persistent ) return false;

        for ( const connection of this.#connections ) connection.publish( name, ...params );

        return true;
    }

    // protected
    async _connectWebSocket () {
        if ( !this.persistent ) return;

        // set reconnect interval if not browser and interval is not set
        if ( !this.isBrowser && !this.#connectClearInterval ) this.#connectClearInterval = setInterval( () => this._connectWebSocket(), CONNECT_INTERVAL );

        // max connections reached
        if ( this.activeConnections >= this.maxConnections ) return;

        if ( !this.#connectMutex.tryDown() ) return;

        try {
            const records = await this._lookup( this.websocketUrl.hostname );

            // unable to resolve hostname
            if ( !records ) throw Error;

            for ( const record of records ) {

                // max connections reached
                if ( this.activeConnections >= this.maxConnections ) break;

                // connection to this address is already established
                if ( this.#connectionsHostnames.has( record.address ) ) continue;

                let url = this.websocketUrl,
                    hostname;

                if ( url.hostname !== record.address ) {
                    hostname = url.hostname;
                    url = new URL( url );
                    url.hostname = record.address;
                }

                const connection = new Connection( this, url, hostname );

                connection.on( "open", this.#onConnectionOpen.bind( this ) );
                connection.on( "close", this.#onConnectionClose.bind( this ) );
                connection.on( "event", this.#onConnectionEvent.bind( this ) );

                this.#connectionsHostnames.add( connection.hostname );
                this.#connections.unshift( connection );
            }
        }
        catch ( e ) {}

        this.#getConnectionSignal.broadcast();

        this.#connectMutex.up();
    }

    // private
    #onConnectionOpen ( connection ) {
        this.emit( "open" );
    }

    #onConnectionClose ( connection, res ) {
        this.#connectionsHostnames.delete( connection.hostname );

        for ( let n = 0; n < this.#connections.length; n++ ) {
            if ( this.#connections[n] === connection ) {
                this.#connections.splice( n, 1 );

                break;
            }
        }

        if ( !this.activeConnections ) {
            this.emit( "close", res );

            if ( res.status === 1100 ) this.emit( "signout" );
        }

        // reconnect
        this._connectWebSocket();
    }

    #onConnectionEvent ( name, params ) {
        this.emit( "event", name, params );

        this.emit( "event/" + name, ...params );
    }

    #close () {
        for ( const connection of this.#connections ) connection.close();
    }

    #startPong () {
        if ( !this.persistent ) return;

        for ( const connection of this.#connections ) connection.startPong();
    }
}
